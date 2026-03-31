import mongoose from 'mongoose';

export function canReadVideo(user, videoDoc) {
  if (!user || !videoDoc) return false;
  if (videoDoc.tenantId.toString() !== user.tenantId) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'editor' && videoDoc.createdBy.toString() === user.id) return true;
  if (user.role === 'viewer') {
    const ids = (videoDoc.sharedWith || []).map((id) => id.toString());
    return ids.includes(user.id);
  }
  return false;
}

export function canManageVideo(user, videoDoc) {
  if (!user || !videoDoc) return false;
  if (videoDoc.tenantId.toString() !== user.tenantId) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'editor' && videoDoc.createdBy.toString() === user.id) return true;
  return false;
}

export function parseObjectIds(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
}
