import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import app from '../src/app.js';
import { setupTestDb, teardownTestDb } from './setup.js';

describe('Auth and videos API', () => {
  beforeAll(async () => {
    await setupTestDb();
    const uploadDir = process.env.UPLOAD_DIR;
    fs.mkdirSync(uploadDir, { recursive: true });
  }, 120000);

  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 2000));
    await teardownTestDb();
  }, 15000);

  let token;

  it('registers org admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin@test.dev',
        password: 'password12',
        name: 'Admin',
        organizationName: 'Test Org',
      })
      .expect(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    token = res.body.token;
  });

  it('rejects duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin@test.dev',
        password: 'password12',
        organizationName: 'Other',
      })
      .expect(409);
  });

  it('logs in', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.dev', password: 'password12' }).expect(200);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  it('lists videos (empty)', async () => {
    const res = await request(app).get('/api/videos').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.videos).toEqual([]);
  });

  it('creates viewer user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'viewer@test.dev',
        password: 'password12',
        role: 'viewer',
      })
      .expect(201);
    expect(res.body.user.role).toBe('viewer');
  });

  it('upload requires file', async () => {
    await request(app).post('/api/videos').set('Authorization', `Bearer ${token}`).expect(400);
  });

  it('uploads video file', async () => {
    const fixture = path.join(process.env.UPLOAD_DIR, 'dummy.mp4');
    fs.writeFileSync(fixture, Buffer.alloc(1024, 1));
    const res = await request(app)
      .post('/api/videos')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Demo')
      .attach('video', fixture, { contentType: 'video/mp4', filename: 'demo.mp4' })
      .expect(201);
    expect(res.body.video.status).toBe('pending');
    expect(res.body.video.title).toBe('Demo');
  });
});
