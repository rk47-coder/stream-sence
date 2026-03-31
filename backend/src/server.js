import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import app from './app.js';
import { connectDb } from './config/db.js';
import { setIo } from './services/socketHub.js';
import { verifyToken } from './utils/jwt.js';

const port = parseInt(process.env.PORT || '5050', 10);
const mongoUri = process.env.MONGODB_URI;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

if (!mongoUri) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}

await connectDb(mongoUri);

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: clientOrigin, credentials: true },
});

setIo(io);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) return next(new Error('Unauthorized'));
    const decoded = verifyToken(token, secret);
    socket.data.userId = decoded.sub;
    socket.data.tenantId = decoded.tenantId;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const { tenantId, userId } = socket.data;
  if (tenantId) socket.join(`tenant:${tenantId}`);
  if (userId) socket.join(`user:${userId}`);
});

server.listen(port, () => {
  console.log(`API + Socket.io listening on http://localhost:${port}`);
});
