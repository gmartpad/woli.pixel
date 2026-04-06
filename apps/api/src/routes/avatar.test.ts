import { describe, test, expect, mock, beforeEach } from "bun:test";

// --- Mock dependencies ---

const mockDownloadFromS3 = mock(async () => Buffer.from("fake-webp-image-data"));

mock.module("../lib/s3", () => ({
  downloadFromS3: mockDownloadFromS3,
  uploadToS3: mock(async () => {}),
  createPresignedDownloadUrl: mock(async () => "https://s3.amazonaws.com/presigned"),
  batchDeleteObjects: mock(async () => {}),
  objectExists: mock(async () => false),
  deleteFromS3: mock(async () => {}),
  s3Client: {},
  BUCKET: "test-bucket",
}));

const defaultAvatarRow = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  userId: "user-123",
  s3Key: "avatars/user-123/1234567890.webp",
  fileSize: 12345,
  width: 256,
  height: 256,
  uploadedAt: new Date(),
};

const defaultSelectImpl = () => ({
  from: () => ({
    where: async () => [defaultAvatarRow],
  }),
});

const mockDbSelect = mock(defaultSelectImpl);

mock.module("../db", () => ({
  db: {
    select: mockDbSelect,
  },
}));

mock.module("../db/schema", () => ({
  avatarHistory: {
    id: "id",
    userId: "user_id",
    s3Key: "s3_key",
    fileSize: "file_size",
    width: "width",
    height: "height",
    uploadedAt: "uploaded_at",
  },
}));

const { avatarRouter } = await import("./avatar");

import { Hono } from "hono";

const app = new Hono();

// Public route — no auth middleware
app.route("/api/v1/avatar", avatarRouter);

// --- Tests ---

beforeEach(() => {
  mockDownloadFromS3.mockClear();
  mockDbSelect.mockClear();
  mockDownloadFromS3.mockImplementation(async () => Buffer.from("fake-webp-image-data"));
  mockDbSelect.mockImplementation(defaultSelectImpl);
});

describe("GET /api/v1/avatar/:id", () => {
  test("returns 200 with correct Content-Type and Cache-Control headers", async () => {
    const res = await app.request(
      "/api/v1/avatar/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  test("returns 404 for unknown avatar ID", async () => {
    // Override the DB mock to return empty results
    mockDbSelect.mockImplementation(() => ({
      from: () => ({
        where: async () => [],
      }),
    }));

    const res = await app.request(
      "/api/v1/avatar/00000000-0000-0000-0000-000000000000",
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Avatar");
  });

  test("streams image data from S3 using the s3Key from DB", async () => {
    const imageData = Buffer.from("test-avatar-image-binary-data");
    mockDownloadFromS3.mockImplementation(async () => imageData);

    const res = await app.request(
      "/api/v1/avatar/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );

    expect(res.status).toBe(200);

    // Verify downloadFromS3 was called with the correct s3Key from the DB row
    expect(mockDownloadFromS3).toHaveBeenCalledTimes(1);
    expect(mockDownloadFromS3.mock.calls[0][0]).toBe(
      "avatars/user-123/1234567890.webp",
    );

    // Verify response body contains the image data
    const responseBuffer = Buffer.from(await res.arrayBuffer());
    expect(responseBuffer.toString()).toBe(imageData.toString());

    // Verify Content-Length header matches the buffer length
    expect(res.headers.get("Content-Length")).toBe(String(imageData.length));
  });
});
