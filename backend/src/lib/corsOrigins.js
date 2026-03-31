/**
 * Comma-separated list in CLIENT_ORIGIN, e.g.
 * http://localhost:5173,https://stream-sence.vercel.app
 * First match wins for Socket.io; express `cors` accepts string | string[].
 */
export function getCorsOriginConfig() {
  const raw = process.env.CLIENT_ORIGIN?.trim();
  if (!raw) return true;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true;
  return list.length === 1 ? list[0] : list;
}
