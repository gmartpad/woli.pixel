import { describe, test, expect, mock, beforeEach } from "bun:test";

// --- Mock S3 module (before dynamic import of storage) ---
const mockUploadToS3 = mock(async () => {});
const mockDownloadFromS3 = mock(async () => Buffer.from("image-data"));
const mockCreatePresignedDownloadUrl = mock(
  async () => "https://s3.amazonaws.com/presigned-url"
);
const mockBatchDeleteObjects = mock(async () => {});
const mockDeleteFromS3 = mock(async () => {});

mock.module("../lib/s3", () => ({
  uploadToS3: mockUploadToS3,
  downloadFromS3: mockDownloadFromS3,
  createPresignedDownloadUrl: mockCreatePresignedDownloadUrl,
  deleteFromS3: mockDeleteFromS3,
  batchDeleteObjects: mockBatchDeleteObjects,
  BUCKET: "test-bucket",
  s3Client: {},
}));

// Dynamic import AFTER mocking
const {
  buildOriginalKey,
  buildProcessedKey,
  buildGeneratedKey,
  buildAuditKey,
  buildAvatarKey,
  storeOriginal,
  storeProcessed,
  storeGenerated,
  storeAuditImage,
  storeAvatar,
  getImageBuffer,
  getDownloadUrl,
  deleteFromS3,
  batchDeleteObjects,
} = await import("./storage");

// --- Tests ---

beforeEach(() => {
  mockUploadToS3.mockClear();
  mockDownloadFromS3.mockClear();
  mockCreatePresignedDownloadUrl.mockClear();
  mockDeleteFromS3.mockClear();
  mockBatchDeleteObjects.mockClear();
});

// ============================================================
// 1. Key builders
// ============================================================

describe("buildOriginalKey", () => {
  test("produces originals/{uploadId}/{timestamp}-{filename} format", () => {
    const key = buildOriginalKey("upload-123", "photo.jpg");
    expect(key).toMatch(/^originals\/upload-123\/\d+-photo\.jpg$/);
  });

  test("preserves filename as-is", () => {
    const key = buildOriginalKey("upload-456", "my photo (1).png");
    expect(key).toContain("originals/upload-456/");
    expect(key).toContain("my photo (1).png");
  });
});

describe("buildProcessedKey", () => {
  test("produces processed/{uploadId}/{timestamp}.{ext} format", () => {
    const key = buildProcessedKey("upload-123", "jpeg");
    expect(key).toMatch(/^processed\/upload-123\/\d+\.jpeg$/);
  });
});

describe("buildGeneratedKey", () => {
  test("produces generated/{jobId}/{timestamp}.{ext} format", () => {
    const key = buildGeneratedKey("job-789", "png");
    expect(key).toMatch(/^generated\/job-789\/\d+\.png$/);
  });
});

describe("buildAuditKey", () => {
  test("produces audits/{auditJobId}/{timestamp}-{filename} format", () => {
    const key = buildAuditKey("audit-001", "image.webp");
    expect(key).toMatch(/^audits\/audit-001\/\d+-image\.webp$/);
  });
});

describe("buildAvatarKey", () => {
  test("produces avatars/{userId}/{timestamp}.webp format", () => {
    const key = buildAvatarKey("user-abc-123");
    expect(key).toMatch(/^avatars\/user-abc-123\/\d+\.webp$/);
  });
});

// ============================================================
// 2. storeOriginal
// ============================================================

describe("storeOriginal", () => {
  test("calls uploadToS3 with correct key, buffer, and contentType", async () => {
    const buffer = Buffer.from("png-data");
    const key = await storeOriginal("upload-123", "photo.png", buffer, "image/png");

    expect(mockUploadToS3).toHaveBeenCalledTimes(1);
    const [s3Key, body, contentType] = mockUploadToS3.mock.calls[0];
    expect(s3Key).toMatch(/^originals\/upload-123\//);
    expect(body).toBe(buffer);
    expect(contentType).toBe("image/png");
    expect(key).toBe(s3Key);
  });

  test("returns the S3 key", async () => {
    const key = await storeOriginal("upload-123", "photo.png", Buffer.from("data"), "image/png");
    expect(key).toMatch(/^originals\/upload-123\/\d+-photo\.png$/);
  });
});

// ============================================================
// 3. storeProcessed
// ============================================================

describe("storeProcessed", () => {
  test("calls uploadToS3 with processed key and correct MIME type", async () => {
    const buffer = Buffer.from("jpeg-data");
    const key = await storeProcessed("upload-123", buffer, "jpeg");

    expect(mockUploadToS3).toHaveBeenCalledTimes(1);
    const [s3Key, body, contentType] = mockUploadToS3.mock.calls[0];
    expect(s3Key).toMatch(/^processed\/upload-123\/\d+\.jpeg$/);
    expect(body).toBe(buffer);
    expect(contentType).toBe("image/jpeg");
    expect(key).toBe(s3Key);
  });

  test("maps png format to image/png MIME type", async () => {
    await storeProcessed("upload-123", Buffer.from("data"), "png");
    const [, , contentType] = mockUploadToS3.mock.calls[0];
    expect(contentType).toBe("image/png");
  });

  test("maps webp format to image/webp MIME type", async () => {
    await storeProcessed("upload-123", Buffer.from("data"), "webp");
    const [, , contentType] = mockUploadToS3.mock.calls[0];
    expect(contentType).toBe("image/webp");
  });
});

// ============================================================
// 4. storeGenerated
// ============================================================

describe("storeGenerated", () => {
  test("calls uploadToS3 with generated key", async () => {
    const buffer = Buffer.from("gen-data");
    const key = await storeGenerated("job-789", buffer, "png");

    expect(mockUploadToS3).toHaveBeenCalledTimes(1);
    const [s3Key] = mockUploadToS3.mock.calls[0];
    expect(s3Key).toMatch(/^generated\/job-789\/\d+\.png$/);
    expect(key).toBe(s3Key);
  });
});

// ============================================================
// 5. storeAuditImage
// ============================================================

describe("storeAuditImage", () => {
  test("calls uploadToS3 with audit key", async () => {
    const buffer = Buffer.from("audit-data");
    const key = await storeAuditImage("audit-001", "scan.jpg", buffer, "image/jpeg");

    expect(mockUploadToS3).toHaveBeenCalledTimes(1);
    const [s3Key, body, contentType] = mockUploadToS3.mock.calls[0];
    expect(s3Key).toMatch(/^audits\/audit-001\/\d+-scan\.jpg$/);
    expect(body).toBe(buffer);
    expect(contentType).toBe("image/jpeg");
    expect(key).toBe(s3Key);
  });
});

// ============================================================
// 6. storeAvatar
// ============================================================

describe("storeAvatar", () => {
  test("calls uploadToS3 with avatar key and image/webp content type", async () => {
    const buffer = Buffer.from("avatar-data");
    const key = await storeAvatar("user-abc-123", buffer);

    expect(mockUploadToS3).toHaveBeenCalledTimes(1);
    const [s3Key, body, contentType] = mockUploadToS3.mock.calls[0];
    expect(s3Key).toMatch(/^avatars\/user-abc-123\/\d+\.webp$/);
    expect(body).toBe(buffer);
    expect(contentType).toBe("image/webp");
    expect(key).toBe(s3Key);
  });
});

// ============================================================
// 7. getImageBuffer
// ============================================================

describe("getImageBuffer", () => {
  test("delegates to downloadFromS3", async () => {
    const result = await getImageBuffer("originals/abc/test.jpg");
    expect(mockDownloadFromS3).toHaveBeenCalledWith("originals/abc/test.jpg");
    expect(result).toEqual(Buffer.from("image-data"));
  });
});

// ============================================================
// 7. getDownloadUrl
// ============================================================

describe("getDownloadUrl", () => {
  test("delegates to createPresignedDownloadUrl without filename", async () => {
    const url = await getDownloadUrl("processed/abc/123.jpg");
    expect(mockCreatePresignedDownloadUrl).toHaveBeenCalledWith("processed/abc/123.jpg", undefined);
    expect(url).toBe("https://s3.amazonaws.com/presigned-url");
  });

  test("passes filename to createPresignedDownloadUrl", async () => {
    await getDownloadUrl("processed/abc/123.jpg", "my-image.jpg");
    expect(mockCreatePresignedDownloadUrl).toHaveBeenCalledWith(
      "processed/abc/123.jpg",
      "my-image.jpg"
    );
  });
});

// ============================================================
// 8. deleteFromS3
// ============================================================

describe("deleteFromS3", () => {
  test("delegates to s3 deleteFromS3", async () => {
    await deleteFromS3("generated/abc/123.png");
    expect(mockDeleteFromS3).toHaveBeenCalledWith("generated/abc/123.png");
  });
});

// ============================================================
// 9. batchDeleteObjects
// ============================================================

describe("batchDeleteObjects (wrapper)", () => {
  test("delegates to s3 batchDeleteObjects", async () => {
    await batchDeleteObjects(["key1", "key2"]);
    expect(mockBatchDeleteObjects).toHaveBeenCalledWith(["key1", "key2"]);
  });
});
