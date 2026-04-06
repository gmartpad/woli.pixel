import {
  uploadToS3,
  downloadFromS3,
  createPresignedDownloadUrl,
  deleteFromS3,
  batchDeleteObjects as s3BatchDelete,
} from "../lib/s3";

export { deleteFromS3 };

export async function batchDeleteObjects(keys: string[]): Promise<void> {
  return s3BatchDelete(keys);
}

const FORMAT_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// ── Key builders ─────────────────────────────

export function buildOriginalKey(uploadId: string, filename: string): string {
  return `originals/${uploadId}/${Date.now()}-${filename}`;
}

export function buildProcessedKey(uploadId: string, ext: string): string {
  return `processed/${uploadId}/${Date.now()}.${ext}`;
}

export function buildGeneratedKey(jobId: string, ext: string): string {
  return `generated/${jobId}/${Date.now()}.${ext}`;
}

export function buildAuditKey(auditJobId: string, filename: string): string {
  return `audits/${auditJobId}/${Date.now()}-${filename}`;
}

export function buildCropOriginalKey(cropId: string, filename: string): string {
  return `crops/${cropId}/original-${Date.now()}-${filename}`;
}

export function buildCropResultKey(cropId: string, ext: string): string {
  return `crops/${cropId}/cropped-${Date.now()}.${ext}`;
}

export function buildAvatarKey(userId: string): string {
  return `avatars/${userId}/${Date.now()}.webp`;
}

// ── Storage operations ───────────────────────

export async function storeOriginal(
  uploadId: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const s3Key = buildOriginalKey(uploadId, filename);
  await uploadToS3(s3Key, buffer, contentType);
  return s3Key;
}

export async function storeProcessed(
  uploadId: string,
  buffer: Buffer,
  format: string,
): Promise<string> {
  const s3Key = buildProcessedKey(uploadId, format);
  const contentType = FORMAT_TO_MIME[format] || "application/octet-stream";
  await uploadToS3(s3Key, buffer, contentType);
  return s3Key;
}

export async function storeGenerated(
  jobId: string,
  buffer: Buffer,
  format: string,
): Promise<string> {
  const s3Key = buildGeneratedKey(jobId, format);
  const contentType = FORMAT_TO_MIME[format] || "application/octet-stream";
  await uploadToS3(s3Key, buffer, contentType);
  return s3Key;
}

export async function storeAuditImage(
  auditJobId: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const s3Key = buildAuditKey(auditJobId, filename);
  await uploadToS3(s3Key, buffer, contentType);
  return s3Key;
}

export async function storeAvatar(
  userId: string,
  buffer: Buffer,
): Promise<string> {
  const s3Key = buildAvatarKey(userId);
  await uploadToS3(s3Key, buffer, "image/webp");
  return s3Key;
}

export async function storeCropOriginal(
  cropId: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const s3Key = buildCropOriginalKey(cropId, filename);
  await uploadToS3(s3Key, buffer, contentType);
  return s3Key;
}

export async function storeCropResult(
  cropId: string,
  buffer: Buffer,
  format: string,
): Promise<string> {
  const s3Key = buildCropResultKey(cropId, format);
  const contentType = FORMAT_TO_MIME[format] || "application/octet-stream";
  await uploadToS3(s3Key, buffer, contentType);
  return s3Key;
}

export async function getImageBuffer(s3Key: string): Promise<Buffer> {
  return downloadFromS3(s3Key);
}

export async function getDownloadUrl(
  s3Key: string,
  filename?: string,
): Promise<string> {
  return createPresignedDownloadUrl(s3Key, filename);
}
