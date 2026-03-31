/** @type {import('socket.io').Server | null} */
let io = null;

export function setIo(serverIo) {
  io = serverIo;
}

export function getIo() {
  return io;
}

export function emitVideoProgress(tenantId, userId, payload) {
  if (!io) return;
  io.to(`tenant:${tenantId}`).emit('video:progress', payload);
  io.to(`user:${userId}`).emit('video:progress', payload);
}
