import fs, { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

/** Larger read buffer = fewer syscalls, smoother disk → socket flow. */
const READ_BUFFER = Math.min(
  parseInt(process.env.VIDEO_STREAM_READ_BUFFER || '', 10) || 4 * 1024 * 1024,
  16 * 1024 * 1024
);

function streamToResponse(res, readStream) {
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  pipeline(readStream, res).catch((err) => {
    if (res.writableEnded || res.destroyed) return;
    console.error('Video stream pipeline error', err);
    if (!res.headersSent) res.status(500).end();
    else res.destroy(err);
  });
}

export function pipeVideoWithRange(res, absolutePath, mimeType, rangeHeader) {
  if (!fs.existsSync(absolutePath)) return { ok: false, code: 'missing' };

  const stat = fs.statSync(absolutePath);
  const size = stat.size;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  if (!rangeHeader) {
    res.setHeader('Content-Length', size);
    const rs = createReadStream(absolutePath, { highWaterMark: READ_BUFFER });
    streamToResponse(res, rs);
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
  const rs = createReadStream(absolutePath, { start, end: last, highWaterMark: READ_BUFFER });
  streamToResponse(res, rs);
  return { ok: true };
}
