import { describe, test, expect, mock, beforeEach } from "bun:test";

// --- Mock setup (before dynamic imports) ---

const mockS3Send = mock(async () => ({}));
mock.module("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = mockS3Send;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  HeadObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectsCommand: class {
    constructor(public input: unknown) {}
  },
}));

const mockGetSignedUrl = mock(async () => "https://s3.amazonaws.com/signed-url");
mock.module("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// Dynamic imports AFTER mocking
const {
  uploadToS3,
  downloadFromS3,
  createPresignedDownloadUrl,
  objectExists,
  deleteFromS3,
  batchDeleteObjects,
  BUCKET,
} = await import("./s3");

// --- Tests ---

beforeEach(() => {
  mockS3Send.mockClear();
  mockGetSignedUrl.mockClear();
});

// ============================================================
// 1. BUCKET constant
// ============================================================

describe("BUCKET constant", () => {
  test("is defined from env", () => {
    expect(typeof BUCKET).toBe("string");
  });
});

// ============================================================
// 2. uploadToS3
// ============================================================

describe("uploadToS3", () => {
  test("sends PutObjectCommand with correct params and SSE AES256", async () => {
    const body = Buffer.from("image data");
    await uploadToS3("originals/abc/123-test.png", body, "image/png");

    expect(mockS3Send).toHaveBeenCalledTimes(1);
    const cmd = mockS3Send.mock.calls[0][0];
    expect(cmd.input).toMatchObject({
      Key: "originals/abc/123-test.png",
      Body: body,
      ContentType: "image/png",
      ServerSideEncryption: "AES256",
    });
  });

  test("uses the configured bucket", async () => {
    await uploadToS3("originals/abc/test.jpg", Buffer.from("data"), "image/jpeg");
    const cmd = mockS3Send.mock.calls[0][0];
    expect(cmd.input.Bucket).toBe(BUCKET);
  });
});

// ============================================================
// 3. downloadFromS3
// ============================================================

describe("downloadFromS3", () => {
  function setupDownloadMock(contentLength: number, bodyData: Uint8Array) {
    mockS3Send.mockImplementation(async (cmd: unknown) => {
      const name = (cmd as { constructor: { name: string } }).constructor.name;
      if (name === "HeadObjectCommand") {
        return { ContentLength: contentLength };
      }
      if (name === "GetObjectCommand") {
        return {
          Body: {
            transformToWebStream: () =>
              new ReadableStream({
                start(controller) {
                  controller.enqueue(bodyData);
                  controller.close();
                },
              }),
          },
        };
      }
      return {};
    });
  }

  test("returns buffer for file under 20MB", async () => {
    const data = new Uint8Array([10, 20, 30, 40, 50]);
    setupDownloadMock(data.length, data);

    const result = await downloadFromS3("originals/abc/test.jpg");
    expect(result).toBeInstanceOf(Buffer);
    expect(result).toEqual(Buffer.from(data));
  });

  test("throws error when file exceeds 20MB", async () => {
    const oversizedLength = 21 * 1024 * 1024;
    mockS3Send.mockImplementation(async (cmd: unknown) => {
      const name = (cmd as { constructor: { name: string } }).constructor.name;
      if (name === "HeadObjectCommand") {
        return { ContentLength: oversizedLength };
      }
      return {};
    });

    await expect(downloadFromS3("originals/abc/large.jpg")).rejects.toThrow(
      "exceeds maximum allowed size"
    );
  });

  test("throws error when response body is empty", async () => {
    mockS3Send.mockImplementation(async (cmd: unknown) => {
      const name = (cmd as { constructor: { name: string } }).constructor.name;
      if (name === "HeadObjectCommand") {
        return { ContentLength: 100 };
      }
      if (name === "GetObjectCommand") {
        return { Body: null };
      }
      return {};
    });

    await expect(downloadFromS3("originals/abc/test.jpg")).rejects.toThrow(
      "Empty response for S3 key"
    );
  });

  test("concatenates multiple stream chunks into single buffer", async () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5, 6]);

    mockS3Send.mockImplementation(async (cmd: unknown) => {
      const name = (cmd as { constructor: { name: string } }).constructor.name;
      if (name === "HeadObjectCommand") {
        return { ContentLength: 6 };
      }
      if (name === "GetObjectCommand") {
        return {
          Body: {
            transformToWebStream: () =>
              new ReadableStream({
                start(controller) {
                  controller.enqueue(chunk1);
                  controller.enqueue(chunk2);
                  controller.close();
                },
              }),
          },
        };
      }
      return {};
    });

    const result = await downloadFromS3("originals/abc/test.jpg");
    expect(result).toEqual(Buffer.from([1, 2, 3, 4, 5, 6]));
  });
});

// ============================================================
// 4. createPresignedDownloadUrl
// ============================================================

describe("createPresignedDownloadUrl", () => {
  test("returns presigned URL string", async () => {
    const url = await createPresignedDownloadUrl("processed/abc/123.jpg");
    expect(url).toBe("https://s3.amazonaws.com/signed-url");
  });

  test("calls getSignedUrl with 1-hour expiry", async () => {
    await createPresignedDownloadUrl("processed/abc/123.jpg");

    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    const [, , options] = mockGetSignedUrl.mock.calls[0];
    expect(options).toEqual({ expiresIn: 3600 });
  });

  test("includes Content-Disposition when filename is provided", async () => {
    await createPresignedDownloadUrl("processed/abc/123.jpg", "my-image.jpg");

    const [, command] = mockGetSignedUrl.mock.calls[0];
    expect((command as any).input.ResponseContentDisposition).toBe(
      'attachment; filename="my-image.jpg"'
    );
  });

  test("omits Content-Disposition when no filename provided", async () => {
    await createPresignedDownloadUrl("processed/abc/123.jpg");

    const [, command] = mockGetSignedUrl.mock.calls[0];
    expect((command as any).input).not.toHaveProperty("ResponseContentDisposition");
  });
});

// ============================================================
// 5. objectExists
// ============================================================

describe("objectExists", () => {
  test("returns true when HeadObject succeeds", async () => {
    mockS3Send.mockResolvedValueOnce({});
    const result = await objectExists("originals/abc/test.jpg");
    expect(result).toBe(true);
  });

  test("returns false when HeadObject throws (404)", async () => {
    mockS3Send.mockRejectedValueOnce(new Error("NotFound"));
    const result = await objectExists("originals/abc/nonexistent.jpg");
    expect(result).toBe(false);
  });

  test("sends HeadObjectCommand with correct bucket and key", async () => {
    mockS3Send.mockResolvedValueOnce({});
    await objectExists("originals/abc/test.jpg");

    const cmd = mockS3Send.mock.calls[0][0];
    expect(cmd.input).toEqual({
      Bucket: BUCKET,
      Key: "originals/abc/test.jpg",
    });
  });
});

// ============================================================
// 6. deleteFromS3
// ============================================================

describe("deleteFromS3", () => {
  test("sends DeleteObjectsCommand with single key", async () => {
    await deleteFromS3("originals/abc/test.jpg");

    expect(mockS3Send).toHaveBeenCalledTimes(1);
    const cmd = mockS3Send.mock.calls[0][0];
    expect(cmd.input).toMatchObject({
      Bucket: BUCKET,
      Delete: {
        Objects: [{ Key: "originals/abc/test.jpg" }],
        Quiet: true,
      },
    });
  });
});

// ============================================================
// 7. batchDeleteObjects
// ============================================================

describe("batchDeleteObjects", () => {
  test("does nothing when keys array is empty", async () => {
    await batchDeleteObjects([]);
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  test("sends single batch for keys under 1000", async () => {
    const keys = ["key1", "key2", "key3"];
    await batchDeleteObjects(keys);

    expect(mockS3Send).toHaveBeenCalledTimes(1);
    const cmd = mockS3Send.mock.calls[0][0];
    expect(cmd.input.Delete.Objects).toEqual([
      { Key: "key1" },
      { Key: "key2" },
      { Key: "key3" },
    ]);
    expect(cmd.input.Delete.Quiet).toBe(true);
  });

  test("chunks into multiple batches for keys exceeding 1000", async () => {
    const keys = Array.from({ length: 1500 }, (_, i) => `key-${i}`);
    await batchDeleteObjects(keys);

    expect(mockS3Send).toHaveBeenCalledTimes(2);

    const firstCmd = mockS3Send.mock.calls[0][0];
    expect(firstCmd.input.Delete.Objects).toHaveLength(1000);

    const secondCmd = mockS3Send.mock.calls[1][0];
    expect(secondCmd.input.Delete.Objects).toHaveLength(500);
  });
});
