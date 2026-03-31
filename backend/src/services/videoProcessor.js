import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Video } from '../models/Video.js';
import { emitVideoProgress } from './socketHub.js';
import { gridFileLength, drainGridFileToPath } from '../lib/gridfs.js';

const run = promisify(execFile);

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function probeDuration(filePath) {
  try {
    const { stdout } = await run(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      { timeout: 120_000 }
    );
    const n = parseFloat(String(stdout).trim(), 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Move MP4 moov atom to file start — much faster start / seek in browsers (needs ffmpeg on PATH). */
async function tryMp4FastStart(filePath, mimeType) {
  if (mimeType !== 'video/mp4' && mimeType !== 'video/quicktime') return;
  const out = `${filePath}.faststart`;
  try {
    await run(
      'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-y', '-i', filePath, '-c', 'copy', '-movflags', '+faststart', out],
      { timeout: 600_000, maxBuffer: 512 * 1024 }
    );
    await fs.rename(out, filePath);
  } catch {
    await fs.unlink(out).catch(() => {});
  }
}

function scoreFromSeed(seed) {
  const digest = crypto.createHash('sha256').update(seed).digest();
  return digest[0] / 255;
}

export async function processVideoJob(videoId, legacyUploadDir) {
  const doc = await Video.findById(videoId);
  if (!doc) return;

  const tenantId = doc.tenantId.toString();
  const ownerId = doc.createdBy.toString();

  const sync = async (progress, status, patch = {}) => {
    await Video.findByIdAndUpdate(videoId, { progress, status, ...patch });
    emitVideoProgress(tenantId, ownerId, {
      videoId: videoId.toString(),
      progress,
      status,
      ...patch,
    });
  };

  let gridTmpPath = null;
  try {
    await sync(5, 'processing', { sensitivity: 'unknown' });
    await pause(350);

    await sync(22, 'processing');

    let filePath = null;
    let seedKey;

    if (doc.gridFileId) {
      const len = await gridFileLength(doc.gridFileId);
      if (len == null || len === 0) throw new Error('Stored file missing');
      gridTmpPath = path.join(os.tmpdir(), `vs-probe-${crypto.randomUUID()}`);
      await drainGridFileToPath(doc.gridFileId, gridTmpPath);
      filePath = gridTmpPath;
      seedKey = `${doc.gridFileId}|${doc.sizeBytes}`;
    } else if (doc.storedFilename) {
      filePath = path.join(legacyUploadDir, doc.storedFilename);
      const st = await fs.stat(filePath).catch(() => null);
      if (!st) throw new Error('Stored file missing');
      seedKey = `${doc.storedFilename}|${doc.sizeBytes}`;
    } else {
      throw new Error('No file reference on video document');
    }

    await sync(48, 'processing');
    let durationSeconds = null;
    if (filePath) {
      durationSeconds = await probeDuration(filePath);
      if (durationSeconds != null) await Video.findByIdAndUpdate(videoId, { durationSeconds });
      await tryMp4FastStart(filePath, doc.mimeType);
    }

    await sync(72, 'processing');
    await pause(250);

    const seed = `${seedKey}|${durationSeconds ?? 0}`;
    const risky = scoreFromSeed(seed) > 0.82;
    const sensitivity = risky ? 'flagged' : 'safe';
    const sensitivityReason = risky
      ? 'Heuristic: high fingerprint score (demo pipeline).'
      : 'Heuristic: no issue flagged (demo pipeline).';

    await sync(94, 'processing', { sensitivity });

    await Video.findByIdAndUpdate(videoId, {
      progress: 100,
      status: 'ready',
      sensitivity,
      sensitivityReason,
      processingError: '',
    });
    emitVideoProgress(tenantId, ownerId, {
      videoId: videoId.toString(),
      progress: 100,
      status: 'ready',
      sensitivity,
      sensitivityReason,
    });
  } catch (e) {
    const processingError = e instanceof Error ? e.message : 'Processing failed';
    await Video.findByIdAndUpdate(videoId, {
      status: 'failed',
      processingError,
      progress: 0,
    });
    emitVideoProgress(tenantId, ownerId, {
      videoId: videoId.toString(),
      progress: 0,
      status: 'failed',
      processingError,
    });
  } finally {
    if (gridTmpPath) await fs.unlink(gridTmpPath).catch(() => {});
  }
}
