import mongoose from 'mongoose';

const STATUSES = ['pending', 'processing', 'ready', 'failed'];
const SENSITIVITY = ['unknown', 'safe', 'flagged'];

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    originalName: { type: String, required: true },
    /** Legacy: filename on disk under UPLOAD_DIR (older uploads). */
    storedFilename: { type: String, default: null },
    /** GridFS file _id in bucket `videos` (new uploads). */
    gridFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    durationSeconds: { type: Number, default: null },
    status: { type: String, enum: STATUSES, default: 'pending' },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    sensitivity: { type: String, enum: SENSITIVITY, default: 'unknown' },
    sensitivityReason: { type: String, default: '' },
    processingError: { type: String, default: '' },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

videoSchema.index({ tenantId: 1, createdAt: -1 });
videoSchema.index({ tenantId: 1, status: 1 });
videoSchema.index({ tenantId: 1, sensitivity: 1 });
videoSchema.index({ sharedWith: 1 });

export const Video = mongoose.model('Video', videoSchema);
export { STATUSES, SENSITIVITY };
