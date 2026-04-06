import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Readable } from "node:stream";
import sharp from "sharp";

// ── Mock DB ──────────────────────────────────────────────────────
const mockExecute = mock(() => Promise.resolve([]));
const mockSelect = mock();
const mockDelete = mock();
const mockUpdate = mock();

mock.module("../db", () => ({
  db: {
    execute: mockExecute,
    select: mockSelect,
    delete: mockDelete,
    update: mockUpdate,
  },
}));

// ── Mock S3 lib (for streaming in download endpoint) ─────────────
const mockS3Send = mock(async () => ({
  Body: {
    transformToWebStream: () => Readable.toWeb(Readable.from(Buffer.from("fake-image-data"))),
  },
}));

mock.module("../lib/s3", () => ({
  s3Client: { send: mockS3Send },
  BUCKET: "test-bucket",
  downloadFromS3: async () => Buffer.from("fake"),
  uploadToS3: mock(async () => {}),
  createPresignedDownloadUrl: mock(async () => "https://presigned"),
  batchDeleteObjects: mock(async () => {}),
  objectExists: mock(async () => false),
  deleteFromS3: mock(async () => {}),
}));

// Mock service modules that require external API keys at import time
mock.module("../services/ai", () => ({
  analyzeImage: async () => ({}),
  generateExplanation: async () => "",
  analyzeModeration: async () => ({ analysis: "", suggestedPrompt: "" }),
}));

mock.module("../services/providers/recraft", () => ({
  generateWithRecraft: async () => ({ imageBuffer: Buffer.alloc(0), cost: 0 }),
}));

mock.module("../services/providers/flux", () => ({
  generateWithFlux: async () => ({ imageBuffer: Buffer.alloc(0), cost: 0 }),
  ModerationError: class ModerationError extends Error {
    public readonly reasons: string[];
    constructor(reasons: string[]) {
      super(reasons.join(", "));
      this.name = "ModerationError";
      this.reasons = reasons;
    }
  },
}));

mock.module("../services/image-processor", () => ({
  postProcessGenerated: async () => ({}),
}));

// ── Create test image buffer (800x600 red PNG) ──────────────────
const testImageBuffer = await sharp({
  create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 0, b: 0 } },
}).png().toBuffer();

const mockGetImageBuffer = mock(() => Promise.resolve(testImageBuffer));
const mockDeleteFromS3 = mock(() => Promise.resolve());

mock.module("../services/storage", () => ({
  storeGenerated: async () => "generated/abc/123.png",
  getImageBuffer: mockGetImageBuffer,
  getDownloadUrl: async () => "https://s3.amazonaws.com/presigned-url",
  deleteFromS3: mockDeleteFromS3,
}));

// Import AFTER mocking
const { Hono } = await import("hono");
const { historyRouter } = await import("./history");

const testApp = new Hono();
testApp.route("/api/v1/history", historyRouter);

// Helper to extract raw SQL string from Drizzle sql.raw() object
function extractSql(call: unknown[]): string {
  const sqlObj = call[0] as { queryChunks?: { value?: string[] }[] };
  return sqlObj?.queryChunks?.[0]?.value?.[0] ?? String(call[0]);
}

// ── Fixtures ─────────────────────────────────────────────────────
function makeGenerationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    mode: "generation",
    status: "completed",
    created_at: "2026-04-01T12:00:00Z",
    category: "admin",
    image_type_name: "Favicon",
    final_width: 256,
    final_height: 256,
    final_format: "png",
    final_size_kb: 12,
    prompt: "a red square favicon",
    enhanced_prompt: "a red square favicon, high quality",
    model: "flux2_pro",
    quality_tier: "medium",
    cost_usd: "0.0400",
    original_filename: null,
    original_width: null,
    original_height: null,
    original_size_kb: null,
    ai_quality_score: null,
    processed_s3_key: "generated/aaa/123.png",
    ...overrides,
  };
}

function makeUploadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    mode: "upload",
    status: "completed",
    created_at: "2026-04-01T10:00:00Z",
    category: "content",
    image_type_name: "Banner",
    final_width: 1920,
    final_height: 1080,
    final_format: "jpeg",
    final_size_kb: 320,
    prompt: null,
    enhanced_prompt: null,
    model: null,
    quality_tier: null,
    cost_usd: null,
    original_filename: "hero-banner.jpg",
    original_width: 3840,
    original_height: 2160,
    original_size_kb: 1200,
    ai_quality_score: 85,
    processed_s3_key: "uploads/111/processed.jpeg",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe("GET /api/v1/history", () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  test("returns default response with empty results", async () => {
    mockExecute.mockResolvedValueOnce([]); // data query
    mockExecute.mockResolvedValueOnce([{ total: "0" }]); // count query

    const res = await testApp.request("/api/v1/history");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(24);
    expect(body.hasMore).toBe(false);
  });

  test("returns mapped HistoryItem shape for generation row", async () => {
    const row = makeGenerationRow();
    mockExecute.mockResolvedValueOnce([row]);
    mockExecute.mockResolvedValueOnce([{ total: "1" }]);

    const res = await testApp.request("/api/v1/history");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);

    const item = body.items[0];
    expect(item.id).toBe(row.id);
    expect(item.mode).toBe("generation");
    expect(item.status).toBe("completed");
    expect(item.category).toBe("admin");
    expect(item.imageTypeName).toBe("Favicon");
    expect(item.finalWidth).toBe(256);
    expect(item.prompt).toBe("a red square favicon");
    expect(item.model).toBe("flux2_pro");
    expect(item.thumbnailUrl).toContain(row.id);
    expect(item.downloadUrl).toContain(row.id);
  });

  test("returns mapped HistoryItem shape for upload row", async () => {
    const row = makeUploadRow();
    mockExecute.mockResolvedValueOnce([row]);
    mockExecute.mockResolvedValueOnce([{ total: "1" }]);

    const res = await testApp.request("/api/v1/history");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);

    const item = body.items[0];
    expect(item.id).toBe(row.id);
    expect(item.mode).toBe("upload");
    expect(item.originalFilename).toBe("hero-banner.jpg");
    expect(item.aiQualityScore).toBe(85);
    expect(item.thumbnailUrl).toContain(row.id);
    expect(item.downloadUrl).toContain(row.id);
  });

  test("respects page and per_page params", async () => {
    mockExecute.mockResolvedValueOnce([]);
    mockExecute.mockResolvedValueOnce([{ total: "50" }]);

    const res = await testApp.request("/api/v1/history?page=2&per_page=10");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.perPage).toBe(10);
    expect(body.hasMore).toBe(true); // 50 total, page 2 * 10 = 20, so more exist
  });

  test("returns 400 when per_page > 100", async () => {
    const res = await testApp.request("/api/v1/history?per_page=101");
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("mode=generation filters only generation items", async () => {
    const row = makeGenerationRow();
    mockExecute.mockResolvedValueOnce([row]);
    mockExecute.mockResolvedValueOnce([{ total: "1" }]);

    const res = await testApp.request("/api/v1/history?mode=generation");
    expect(res.status).toBe(200);

    // Verify the SQL sent to execute contains only generation query (no UNION)
    const call = mockExecute.mock.calls[0];
    const sqlQuery = extractSql(call);
    expect(sqlQuery).not.toContain("'upload'");
  });

  test("mode=upload filters only upload items", async () => {
    const row = makeUploadRow();
    mockExecute.mockResolvedValueOnce([row]);
    mockExecute.mockResolvedValueOnce([{ total: "1" }]);

    const res = await testApp.request("/api/v1/history?mode=upload");
    expect(res.status).toBe(200);

    const call = mockExecute.mock.calls[0];
    const sqlQuery = extractSql(call);
    expect(sqlQuery).not.toContain("'generation'");
  });

  test("model filter skips upload query (generation-only filter)", async () => {
    mockExecute.mockResolvedValueOnce([]);
    mockExecute.mockResolvedValueOnce([{ total: "0" }]);

    const res = await testApp.request("/api/v1/history?model=flux2_pro");
    expect(res.status).toBe(200);

    const call = mockExecute.mock.calls[0];
    const sqlQuery = extractSql(call);
    expect(sqlQuery).not.toContain("'upload'");
  });

  test("quality filter skips upload query (generation-only filter)", async () => {
    mockExecute.mockResolvedValueOnce([]);
    mockExecute.mockResolvedValueOnce([{ total: "0" }]);

    const res = await testApp.request("/api/v1/history?quality=high");
    expect(res.status).toBe(200);

    const call = mockExecute.mock.calls[0];
    const sqlQuery = extractSql(call);
    expect(sqlQuery).not.toContain("'upload'");
  });

  test("category filter is included in SQL", async () => {
    mockExecute.mockResolvedValueOnce([]);
    mockExecute.mockResolvedValueOnce([{ total: "0" }]);

    const res = await testApp.request("/api/v1/history?category=admin,content");
    expect(res.status).toBe(200);

    const call = mockExecute.mock.calls[0];
    const sqlQuery = extractSql(call);
    expect(sqlQuery).toContain("admin");
    expect(sqlQuery).toContain("content");
  });

  test("date_preset filter is applied", async () => {
    mockExecute.mockResolvedValueOnce([]);
    mockExecute.mockResolvedValueOnce([{ total: "0" }]);

    const res = await testApp.request("/api/v1/history?date_preset=today");
    expect(res.status).toBe(200);

    const call = mockExecute.mock.calls[0];
    const sqlQuery = extractSql(call);
    expect(sqlQuery).toContain("created_at");
  });

  test("custom date_from and date_to are applied", async () => {
    mockExecute.mockResolvedValueOnce([]);
    mockExecute.mockResolvedValueOnce([{ total: "0" }]);

    const res = await testApp.request(
      "/api/v1/history?date_from=2026-03-01T00:00:00Z&date_to=2026-03-31T23:59:59Z",
    );
    expect(res.status).toBe(200);

    const call = mockExecute.mock.calls[0];
    const sqlQuery = extractSql(call);
    expect(sqlQuery).toContain("2026-03-01");
    expect(sqlQuery).toContain("2026-03-31");
  });

  test("search param is applied with ILIKE and sanitized against SQL injection", async () => {
    mockExecute.mockResolvedValueOnce([]);
    mockExecute.mockResolvedValueOnce([{ total: "0" }]);

    const res = await testApp.request("/api/v1/history?search=red%20square");
    expect(res.status).toBe(200);

    const call = mockExecute.mock.calls[0];
    const sqlQuery = extractSql(call);
    expect(sqlQuery).toContain("ILIKE");
    expect(sqlQuery).toContain("red square");
  });

  test("search param escapes single quotes to prevent SQL injection", async () => {
    mockExecute.mockResolvedValueOnce([]);
    mockExecute.mockResolvedValueOnce([{ total: "0" }]);

    const res = await testApp.request("/api/v1/history?search=test'%3BDROP%20TABLE");
    expect(res.status).toBe(200);

    const call = mockExecute.mock.calls[0];
    const sqlQuery = extractSql(call);
    // Single quotes should be escaped (doubled), preventing breakout from the ILIKE string
    expect(sqlQuery).toContain("test''");
    // The semicolon is neutralized inside the escaped string — cannot terminate the statement
    expect(sqlQuery).not.toContain("test';");
  });

  test("status=completed filters only completed items", async () => {
    mockExecute.mockResolvedValueOnce([]);
    mockExecute.mockResolvedValueOnce([{ total: "0" }]);

    const res = await testApp.request("/api/v1/history?status=completed");
    expect(res.status).toBe(200);

    const call = mockExecute.mock.calls[0];
    const sqlQuery = extractSql(call);
    expect(sqlQuery).toContain("completed");
  });

  test("hasMore is true when more pages exist", async () => {
    mockExecute.mockResolvedValueOnce([makeGenerationRow()]);
    mockExecute.mockResolvedValueOnce([{ total: "30" }]);

    const res = await testApp.request("/api/v1/history?page=1&per_page=24");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hasMore).toBe(true);
  });

  test("hasMore is false when on last page", async () => {
    mockExecute.mockResolvedValueOnce([makeGenerationRow()]);
    mockExecute.mockResolvedValueOnce([{ total: "1" }]);

    const res = await testApp.request("/api/v1/history?page=1&per_page=24");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hasMore).toBe(false);
  });

  test("handles db.execute() returning { rows: [] } shape (Drizzle 0.30+)", async () => {
    const row = makeGenerationRow();
    mockExecute.mockResolvedValueOnce({ rows: [row] });
    mockExecute.mockResolvedValueOnce({ rows: [{ total: "1" }] });

    const res = await testApp.request("/api/v1/history");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(row.id);
    expect(body.total).toBe(1);
  });
});

// ── Thumbnail tests ─────────────────────────────────────────────

describe("GET /api/v1/history/:id/thumbnail", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockGetImageBuffer.mockReset();
    mockGetImageBuffer.mockImplementation(() => Promise.resolve(testImageBuffer));
  });

  // Helper: build the Drizzle select chain mock for a single record lookup
  function mockDbSelectChain(result: Record<string, unknown>[] | []) {
    const whereFn = mock(() => Promise.resolve(result));
    const fromFn = mock(() => ({ where: whereFn }));
    mockSelect.mockReturnValue({ from: fromFn });
  }

  test("returns 200 with image/jpeg content type and Cache-Control header", async () => {
    mockDbSelectChain([{ key: "generated/aaa/123.png" }]);

    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/thumbnail?mode=generation",
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  test("returns a valid JPEG buffer", async () => {
    mockDbSelectChain([{ key: "generated/aaa/123.png" }]);

    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/thumbnail?mode=generation",
    );

    expect(res.status).toBe(200);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const metadata = await sharp(buffer).metadata();
    expect(metadata.format).toBe("jpeg");
  });

  test("thumbnail width is at most 400px", async () => {
    mockDbSelectChain([{ key: "generated/aaa/123.png" }]);

    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/thumbnail?mode=generation",
    );

    expect(res.status).toBe(200);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBeLessThanOrEqual(400);
  });

  test("thumbnail preserves aspect ratio (800x600 -> 400x300)", async () => {
    mockDbSelectChain([{ key: "generated/aaa/123.png" }]);

    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/thumbnail?mode=generation",
    );

    expect(res.status).toBe(200);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(300);
  });

  test("does not enlarge images smaller than 400px wide", async () => {
    // Create a small 200x150 test image
    const smallImage = await sharp({
      create: { width: 200, height: 150, channels: 3, background: { r: 0, g: 255, b: 0 } },
    }).png().toBuffer();
    mockGetImageBuffer.mockImplementation(() => Promise.resolve(smallImage));
    mockDbSelectChain([{ key: "generated/aaa/small.png" }]);

    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/thumbnail?mode=generation",
    );

    expect(res.status).toBe(200);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(150);
  });

  test("works with mode=upload", async () => {
    mockDbSelectChain([{ key: "uploads/111/processed.jpeg" }]);

    const res = await testApp.request(
      "/api/v1/history/11111111-2222-3333-4444-555555555555/thumbnail?mode=upload",
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  test("returns 404 for unknown id", async () => {
    mockDbSelectChain([]);

    const res = await testApp.request(
      "/api/v1/history/00000000-0000-0000-0000-000000000000/thumbnail?mode=generation",
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns 404 when record has no S3 key", async () => {
    mockDbSelectChain([{ key: null }]);

    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/thumbnail?mode=generation",
    );

    expect(res.status).toBe(404);
  });
});

// ── Delete tests ────────────────────────────────────────────────

describe("DELETE /api/v1/history/:id", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockDelete.mockReset();
    mockDeleteFromS3.mockReset();
    mockDeleteFromS3.mockImplementation(() => Promise.resolve());
  });

  // Helper: build the Drizzle select chain mock for lookup
  function mockDbSelectChain(result: Record<string, unknown>[] | []) {
    const whereFn = mock(() => Promise.resolve(result));
    const fromFn = mock(() => ({ where: whereFn }));
    mockSelect.mockReturnValue({ from: fromFn });
  }

  // Helper: build the Drizzle delete chain mock
  function mockDbDeleteChain() {
    const whereFn = mock(() => Promise.resolve());
    mockDelete.mockReturnValue({ where: whereFn });
  }

  test("returns 204 for successful deletion of a generation job", async () => {
    mockDbSelectChain([{ processedS3Key: "generated/aaa/123.png" }]);
    mockDbDeleteChain();

    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee?mode=generation",
      { method: "DELETE" },
    );

    expect(res.status).toBe(204);
    // Should delete the processed S3 key
    expect(mockDeleteFromS3).toHaveBeenCalledWith("generated/aaa/123.png");
    // Should only call deleteFromS3 once (no original key for generations)
    expect(mockDeleteFromS3).toHaveBeenCalledTimes(1);
  });

  test("returns 204 for successful deletion of an upload (deletes both S3 keys)", async () => {
    mockDbSelectChain([{
      originalS3Key: "originals/111/hero.jpg",
      processedS3Key: "uploads/111/processed.jpeg",
    }]);
    mockDbDeleteChain();

    const res = await testApp.request(
      "/api/v1/history/11111111-2222-3333-4444-555555555555?mode=upload",
      { method: "DELETE" },
    );

    expect(res.status).toBe(204);
    // Should delete both original and processed S3 keys
    expect(mockDeleteFromS3).toHaveBeenCalledTimes(2);
    expect(mockDeleteFromS3).toHaveBeenCalledWith("originals/111/hero.jpg");
    expect(mockDeleteFromS3).toHaveBeenCalledWith("uploads/111/processed.jpeg");
  });

  test("returns 404 for unknown id", async () => {
    mockDbSelectChain([]);

    const res = await testApp.request(
      "/api/v1/history/00000000-0000-0000-0000-000000000000?mode=generation",
      { method: "DELETE" },
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("skips S3 deletion when keys are null", async () => {
    mockDbSelectChain([{ processedS3Key: null }]);
    mockDbDeleteChain();

    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee?mode=generation",
      { method: "DELETE" },
    );

    expect(res.status).toBe(204);
    expect(mockDeleteFromS3).not.toHaveBeenCalled();
  });

  test("deletes the DB row", async () => {
    mockDbSelectChain([{ processedS3Key: "generated/aaa/123.png" }]);
    mockDbDeleteChain();

    await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee?mode=generation",
      { method: "DELETE" },
    );

    expect(mockDelete).toHaveBeenCalled();
  });
});

// ── Bulk download (ZIP) tests ────────────────────────────────────

describe("POST /api/v1/history/download", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockS3Send.mockReset();
    mockS3Send.mockImplementation(async () => ({
      Body: {
        transformToWebStream: () => Readable.toWeb(Readable.from(Buffer.from("fake-image-data"))),
      },
    }));
  });

  // Helper: mock two chained select calls (generation + upload)
  function mockTwoSelects(
    generationResult: Record<string, unknown>[],
    uploadResult: Record<string, unknown>[],
  ) {
    let callCount = 0;
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: async () => {
          callCount++;
          return callCount === 1 ? generationResult : uploadResult;
        },
      }),
    }));
  }

  test("returns 400 when ids array is empty", async () => {
    const res = await testApp.request("/api/v1/history/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns 400 when ids is missing", async () => {
    const res = await testApp.request("/api/v1/history/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  test("returns 404 when no files found for given ids", async () => {
    // Both queries return empty — no processedS3Key
    mockTwoSelects([], []);

    const res = await testApp.request("/api/v1/history/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["nonexistent-id"] }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns ZIP with correct content type and disposition for generation files", async () => {
    mockTwoSelects(
      [{ id: "gen-1", processedS3Key: "generated/gen-1/123.png", processedFormat: "png" }],
      [],
    );

    const res = await testApp.request("/api/v1/history/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["gen-1"] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="woli-pixel-images.zip"');
  });

  test("returns ZIP for upload files using originalFilename", async () => {
    mockTwoSelects(
      [],
      [{
        id: "upl-1",
        processedS3Key: "processed/upl-1/123.jpeg",
        processedFormat: "jpeg",
        originalFilename: "my-photo.jpeg",
      }],
    );

    const res = await testApp.request("/api/v1/history/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["upl-1"] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
  });

  test("streams a valid ZIP file (starts with PK signature)", async () => {
    mockTwoSelects(
      [{ id: "gen-1", processedS3Key: "generated/gen-1/123.png", processedFormat: "png" }],
      [],
    );

    const res = await testApp.request("/api/v1/history/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["gen-1"] }),
    });

    expect(res.status).toBe(200);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // ZIP files start with PK (0x50, 0x4B)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  test("calls S3 for each file with processedS3Key", async () => {
    mockTwoSelects(
      [
        { id: "gen-1", processedS3Key: "generated/gen-1/a.png", processedFormat: "png" },
        { id: "gen-2", processedS3Key: "generated/gen-2/b.png", processedFormat: "png" },
      ],
      [],
    );

    const res = await testApp.request("/api/v1/history/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["gen-1", "gen-2"] }),
    });

    expect(res.status).toBe(200);
    // Consume the response to let the archive finalize
    await res.arrayBuffer();
    // S3 send should have been called twice (once per file)
    expect(mockS3Send).toHaveBeenCalledTimes(2);
  });

  test("skips rows without processedS3Key", async () => {
    mockTwoSelects(
      [
        { id: "gen-1", processedS3Key: "generated/gen-1/a.png", processedFormat: "png" },
        { id: "gen-2", processedS3Key: null, processedFormat: null },
      ],
      [],
    );

    const res = await testApp.request("/api/v1/history/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["gen-1", "gen-2"] }),
    });

    expect(res.status).toBe(200);
    await res.arrayBuffer();
    // Only one file should have been fetched from S3
    expect(mockS3Send).toHaveBeenCalledTimes(1);
  });
});

// ── PATCH rename tests ──────────────────────────────────────────

describe("PATCH /api/v1/history/:id/rename", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  // Helper: build the Drizzle update().set().where() chain mock
  function mockDbUpdateChain(rowCount: number) {
    const whereFn = mock(() => Promise.resolve({ rowCount }));
    const setFn = mock(() => ({ where: whereFn }));
    mockUpdate.mockReturnValue({ set: setFn });
  }

  test("returns 200 with displayName for valid generation rename", async () => {
    mockDbUpdateChain(1);

    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/rename",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generation", displayName: "Meu Banner" }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe("Meu Banner");
  });

  test("returns 200 for valid upload rename", async () => {
    mockDbUpdateChain(1);

    const res = await testApp.request(
      "/api/v1/history/11111111-2222-3333-4444-555555555555/rename",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "upload", displayName: "Foto Principal" }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe("Foto Principal");
  });

  test("returns 200 for valid crop rename", async () => {
    mockDbUpdateChain(1);

    const res = await testApp.request(
      "/api/v1/history/22222222-3333-4444-5555-666666666666/rename",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "crop", displayName: "Recorte Especial" }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe("Recorte Especial");
  });

  test("returns 200 with null when clearing custom name", async () => {
    mockDbUpdateChain(1);

    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/rename",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generation", displayName: null }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBeNull();
  });

  test("trims whitespace from displayName", async () => {
    mockDbUpdateChain(1);

    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/rename",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generation", displayName: "  Meu Banner  " }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe("Meu Banner");
  });

  test("returns 400 for missing mode", async () => {
    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/rename",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Test" }),
      },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns 400 for empty string displayName", async () => {
    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/rename",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generation", displayName: "" }),
      },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns 400 for whitespace-only displayName", async () => {
    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/rename",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generation", displayName: "   " }),
      },
    );

    expect(res.status).toBe(400);
  });

  test("returns 400 for displayName exceeding 255 chars", async () => {
    const longName = "A".repeat(256);
    const res = await testApp.request(
      "/api/v1/history/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/rename",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generation", displayName: longName }),
      },
    );

    expect(res.status).toBe(400);
  });

  test("returns 404 for non-existent ID", async () => {
    mockDbUpdateChain(0);

    const res = await testApp.request(
      "/api/v1/history/00000000-0000-0000-0000-000000000000/rename",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generation", displayName: "Test" }),
      },
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
