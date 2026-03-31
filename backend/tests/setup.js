import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mongoCacheDir = path.join(__dirname, '..', '.mongo-ms-cache');

let mongod;

export async function setupTestDb() {
  mongod = await MongoMemoryServer.create({
    binary: { downloadDir: mongoCacheDir },
  });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test-secret-key-for-jwt';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.UPLOAD_DIR = '/tmp/video-upload-test';
  await connectDb(uri);
}

export async function teardownTestDb() {
  try {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  } catch {
    /* connection may already be closed by async workers */
  }
  if (mongod) await mongod.stop();
}
