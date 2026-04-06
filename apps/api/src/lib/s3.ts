import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "sa-east-1",
  requestChecksumCalculation: "WHEN_REQUIRED",
  ...(process.env.AWS_ENDPOINT_URL && {
    endpoint: process.env.AWS_ENDPOINT_URL,
    forcePathStyle: true,
  }),
});

export const BUCKET = process.env.S3_BUCKET || "woli-pixel-uploads";

const DOWNLOAD_URL_EXPIRY = 60 * 60; // 1 hour
const MAX_DOWNLOAD_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export async function uploadToS3(
  s3Key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  });

  await s3Client.send(command);
}

export async function downloadFromS3(s3Key: string): Promise<Buffer> {
  // Check file size before downloading to prevent memory exhaustion
  const headCommand = new HeadObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  });

  const headResponse = await s3Client.send(headCommand);
  const contentLength = headResponse.ContentLength ?? 0;

  if (contentLength > MAX_DOWNLOAD_SIZE_BYTES) {
    const sizeMB = (contentLength / (1024 * 1024)).toFixed(1);
    const maxMB = (MAX_DOWNLOAD_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    throw new Error(
      `File size (${sizeMB}MB) exceeds maximum allowed size (${maxMB}MB).`
    );
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error(`Empty response for S3 key: ${s3Key}`);
  }

  const chunks: Uint8Array[] = [];
  const reader = response.Body.transformToWebStream().getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

export async function createPresignedDownloadUrl(
  s3Key: string,
  filename?: string,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ...(filename && {
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: DOWNLOAD_URL_EXPIRY,
  });
}

export async function objectExists(s3Key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteFromS3(s3Key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: [{ Key: s3Key }], Quiet: true },
    })
  );
}

export async function batchDeleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const BATCH_SIZE = 1000; // AWS limit per call
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: batch.map((key) => ({ Key: key })), Quiet: true },
      })
    );
  }
}
