import { PassThrough } from 'node:stream';

/** Larger reads = fewer syscalls / round-trips; helps smooth HTML5 video playback. */
export const VIDEO_READ_HIGH_WATER = 1024 * 1024; // 1 MiB

export function attachStreamError(readable, res, label = 'stream') {
  readable.on('error', (err) => {
    console.error(`${label} error`, err);
    if (!res.headersSent) res.status(500).end();
    else res.destroy(err);
  });
}

/** Decouple GridFS chunk delivery from response socket backpressure (fewer stalls on Atlas). */
export function bufferReadableToResponse(readable, res) {
  const pass = new PassThrough({ highWaterMark: VIDEO_READ_HIGH_WATER });
  attachStreamError(readable, res, 'Video read');
  attachStreamError(pass, res, 'Video buffer');
  return readable.pipe(pass).pipe(res);
}
