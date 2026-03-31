import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Video } from '../models/Video.js';
import { User } from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';
import { canReadVideo, canManageVideo, parseObjectIds } from '../lib/videoAccess.js';
import { processVideoJob } from '../services/videoProcessor.js';
import { pipeVideoWithRange } from '../services/videoStream.js';
import { pipeGridFsWithRange, deleteGridFile } from '../lib/gridfs.js';

const router = Router();

const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
]);

function uploadRoot() {
  return path.resolve(process.env.UPLOAD_DIR || './uploads');
}

function makeUploader() {
  const maxMb = parseInt(process.env.MAX_VIDEO_SIZE_MB || '500', 10);
  const root = uploadRoot();
  fs.mkdirSync(root, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, root),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '') || '';
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
      else cb(new Error('Unsupported video type'));
    },
  });
}

router.use(authMiddleware(true));

router.post(
  '/',
  requireMinRole('editor'),
  (req, res, next) => {
    makeUploader().single('video')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large' });
        }
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  },
  [body('title').optional().trim(), body('description').optional().trim()],
  async (req, res) => {
    if (!req.file?.path) return res.status(400).json({ error: 'Video file required (field: video)' });

    const title = (req.body.title && String(req.body.title).trim()) || path.parse(req.file.originalname).name;
    const storedFilename = path.basename(req.file.path);

    const video = await Video.create({
      title,
      description: req.body.description || '',
      originalName: req.file.originalname,
      gridFileId: null,
      storedFilename,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      tenantId: req.user.tenantId,
      createdBy: req.user.id,
      status: 'pending',
      progress: 0,
    });

    setImmediate(() => processVideoJob(video._id, uploadRoot()));

    res.status(201).json({ video });
  }
);

router.get(
  '/',
  [
    query('status').optional().isIn(['pending', 'processing', 'ready', 'failed']),
    query('sensitivity').optional().isIn(['unknown', 'safe', 'flagged']),
    query('search').optional().trim(),
    query('fromDate').optional().isISO8601(),
    query('toDate').optional().isISO8601(),
    query('minSize').optional().isInt({ min: 0 }),
    query('maxSize').optional().isInt({ min: 0 }),
    query('minDuration').optional().isFloat({ min: 0 }),
    query('maxDuration').optional().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const q = { tenantId: req.user.tenantId };

    if (req.user.role === 'admin') {
      /* whole tenant */
    } else if (req.user.role === 'editor') {
      q.createdBy = new mongoose.Types.ObjectId(req.user.id);
    } else {
      q.sharedWith = new mongoose.Types.ObjectId(req.user.id);
    }

    if (req.query.status) q.status = req.query.status;
    if (req.query.sensitivity) q.sensitivity = req.query.sensitivity;
    if (req.query.search) {
      q.title = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    if (req.query.fromDate || req.query.toDate) {
      q.createdAt = {};
      if (req.query.fromDate) q.createdAt.$gte = new Date(req.query.fromDate);
      if (req.query.toDate) q.createdAt.$lte = new Date(req.query.toDate);
    }
    if (req.query.minSize != null || req.query.maxSize != null) {
      q.sizeBytes = {};
      if (req.query.minSize != null) q.sizeBytes.$gte = Number(req.query.minSize);
      if (req.query.maxSize != null) q.sizeBytes.$lte = Number(req.query.maxSize);
    }
    if (req.query.minDuration != null || req.query.maxDuration != null) {
      q.durationSeconds = {};
      if (req.query.minDuration != null) q.durationSeconds.$gte = Number(req.query.minDuration);
      if (req.query.maxDuration != null) q.durationSeconds.$lte = Number(req.query.maxDuration);
    }

    const videos = await Video.find(q).sort({ createdAt: -1 }).populate('createdBy', 'name email').limit(200);
    res.json({ videos });
  }
);

router.get('/:id/stream', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const video = await Video.findOne({ _id: req.params.id, tenantId: req.user.tenantId }).lean();
  if (!video) return res.status(404).json({ error: 'Not found' });
  if (!canReadVideo(req.user, video)) return res.status(403).json({ error: 'Forbidden' });
  if (video.status !== 'ready') return res.status(425).json({ error: 'Video not ready for streaming' });

  if (video.gridFileId) {
    const result = await pipeGridFsWithRange(res, video.gridFileId, video.mimeType, req.headers.range, {
      knownLength: video.sizeBytes,
    });
    if (!result.ok && result.code === 'missing') return res.status(404).json({ error: 'File missing' });
    return;
  }

  if (video.storedFilename) {
    const absPath = path.join(uploadRoot(), video.storedFilename);
    const result = pipeVideoWithRange(res, absPath, video.mimeType, req.headers.range);
    if (!result.ok && result.code === 'missing') return res.status(404).json({ error: 'File missing' });
    return;
  }

  return res.status(404).json({ error: 'File missing' });
});

router.get('/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const video = await Video.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!video) return res.status(404).json({ error: 'Not found' });
  if (!canReadVideo(req.user, video)) return res.status(403).json({ error: 'Forbidden' });
  res.json({ video });
});

router.patch(
  '/:id',
  requireMinRole('editor'),
  [param('id').isMongoId(), body('title').optional().trim().notEmpty(), body('description').optional().trim()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const video = await Video.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!video) return res.status(404).json({ error: 'Not found' });
    if (!canManageVideo(req.user, video)) return res.status(403).json({ error: 'Forbidden' });

    if (req.body.title != null) video.title = req.body.title;
    if (req.body.description != null) video.description = req.body.description;
    await video.save();
    res.json({ video });
  }
);

router.post(
  '/:id/share',
  requireMinRole('editor'),
  [param('id').isMongoId(), body('userIds').isArray({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const video = await Video.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!video) return res.status(404).json({ error: 'Not found' });
    if (!canManageVideo(req.user, video)) return res.status(403).json({ error: 'Forbidden' });

    const ids = parseObjectIds(req.body.userIds);
    const viewers = await User.find({ _id: { $in: ids }, tenantId: req.user.tenantId, role: 'viewer' });
    const merged = new Set([...video.sharedWith.map((x) => x.toString()), ...viewers.map((u) => u._id.toString())]);
    video.sharedWith = [...merged].map((id) => new mongoose.Types.ObjectId(id));
    await video.save();
    res.json({ video });
  }
);

router.delete('/:id', requireMinRole('editor'), param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const video = await Video.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!video) return res.status(404).json({ error: 'Not found' });
  if (!canManageVideo(req.user, video)) return res.status(403).json({ error: 'Forbidden' });

  if (video.gridFileId) await deleteGridFile(video.gridFileId);
  else if (video.storedFilename) fs.unlink(path.join(uploadRoot(), video.storedFilename), () => {});

  await video.deleteOne();
  res.status(204).send();
});

export default router;
