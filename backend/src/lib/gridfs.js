import mongoose from 'mongoose';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

/** Read-ahead between GridFS chunks and the HTTP socket (helps Atlas latency). */
const GRIDFS_OUT_BUFFER = Math.min(
  parseInt(process.env.VIDEO_GRIDFS_BUFFER || '', 10) || 4 * 1024 * 1024,
  32 * 1024 * 1024
);

const BUCKET = 'videos';

export function getBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Mongo not connected');
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
}

export function filesCollection() {
  return mongoose.connection.db.collection(`${BUCKET}.files`);
}

function toObjectId(id) {
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(id);
  return id;
}

export async function gridFileLength(fileId) {
  const meta = await filesCollection().findOne({ _id: toObjectId(fileId) });
  return meta?.length ?? null;
}

export async function deleteGridFile(fileId) {
  try {
    await getBucket().delete(toObjectId(fileId));
  } catch (e) {
    const msg = String(e?.message || e);
    if (!msg.includes('FileNotFound') && e?.code !== 'ENOENT') throw e;
  }
}

/**
 * Stream GridFS file with optional HTTP Range (206).
 * Pass `knownLength` from the Video document to skip an extra DB read on every range request.
 * @returns {Promise<{ ok: boolean, code?: string }>}
 */
export async function pipeGridFsWithRange(res, fileId, mimeType, rangeHeader, opts = {}) {
  const id = toObjectId(fileId);
  const known = opts.knownLength;
  const size =
    typeof known === 'number' && known > 0 ? known : await gridFileLength(id);
  if (size == null || size === 0) return { ok: false, code: 'missing' };

  const bucket = getBucket();

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  function pipeGridToSocket(downloadStream) {
    const bridge = new PassThrough({ highWaterMark: GRIDFS_OUT_BUFFER });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    pipeline(downloadStream, bridge, res).catch((err) => {
      if (res.writableEnded || res.destroyed) return;
      console.error('GridFS stream error', err);
      if (!res.headersSent) res.status(500).end();
      else res.destroy(err);
    });
  }

  if (!rangeHeader) {
    res.setHeader('Content-Length', size);
    pipeGridToSocket(bucket.openDownloadStream(id));
    return { ok: true };
  }

  const parts = String(rangeHeader).replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : size - 1;

  if (Number.isNaN(start) || start >= size || end < start) {
    res.status(416);
    res.setHeader('Content-Range', `bytes */${size}`);
    res.end();
    return { ok: true };
  }

  const last = Math.min(end, size - 1);
  const chunk = last - start + 1;

  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${last}/${size}`);
  res.setHeader('Content-Length', chunk);
  pipeGridToSocket(bucket.openDownloadStream(id, { start, end: last }));
  return { ok: true };
}

/** Write full GridFS file to a temp path (ffprobe needs a path here). */
export async function drainGridFileToPath(fileId, destPath) {
  const bucket = getBucket();
  await pipeline(bucket.openDownloadStream(toObjectId(fileId)), createWriteStream(destPath));
}
