import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import sharp from "sharp";

// ── Test fixtures ────────────────────────────────────────────────
const fakeJobId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
let testPngBuffer: Buffer;

beforeAll(async () => {
  testPngBuffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
});

// ── Mock DB ──────────────────────────────────────────────────────
function makeFakeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: fakeJobId,
    imageTypeId: "00000000-0000-0000-0000-000000000001",
    model: "flux2_pro",
    prompt: "test prompt for red square",
    enhancedPrompt: "test prompt for red square",
    qualityTier: "medium",
    style: null,
    generationSizeW: 1024,
    generationSizeH: 1024,
    targetSizeW: 100,
    targetSizeH: 100,
    status: "completed",
    generatedImageUrl: null,
    processedS3Key: "generated/abc/123.png",
    processedFormat: "png",
    processedSizeKb: 1,
    costUsd: "0.0400",
    providerRequestId: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

let dbSelectResult: unknown[] = [];

mock.module("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(dbSelectResult),
      }),
    }),
  },
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

// Use real implementations for all pure helper functions to avoid mock bleed
const realModule = await import("../services/image-generation");
mock.module("../services/image-generation", () => ({ ...realModule }));

// Mock storage service — return the test PNG buffer for getImageBuffer
const mockGetDownloadUrl = mock(async () => "https://s3.amazonaws.com/presigned-url");
const mockGetImageBuffer = mock(async () => testPngBuffer);

mock.module("../services/storage", () => ({
  storeGenerated: async () => "generated/abc/123.png",
  getImageBuffer: mockGetImageBuffer,
  getDownloadUrl: mockGetDownloadUrl,
  deleteFromS3: async () => {},
}));

// Import the app AFTER mocking
const { Hono } = await import("hono");
const { generateRouter } = await import("./generate");

const testApp = new Hono();
testApp.route("/api/v1/generate", generateRouter);

// ── Tests ────────────────────────────────────────────────────────
describe("GET /api/v1/generate/:id/download", () => {
  test("returns 302 redirect to presigned URL when no ?format= param", async () => {
    dbSelectResult = [makeFakeJob()];

    const res = await testApp.request(`/api/v1/generate/${fakeJobId}/download`, {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://s3.amazonaws.com/presigned-url");
  });

  test("returns 302 redirect when same format is requested", async () => {
    dbSelectResult = [makeFakeJob({ processedFormat: "png" })];

    const res = await testApp.request(`/api/v1/generate/${fakeJobId}/download?format=png`, {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
  });

  test("converts to webp when ?format=webp", async () => {
    dbSelectResult = [makeFakeJob()];
    mockGetImageBuffer.mockResolvedValueOnce(testPngBuffer);

    const res = await testApp.request(`/api/v1/generate/${fakeJobId}/download?format=webp`);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Content-Disposition")).toContain(".webp");

    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe("webp");
  });

  test("converts to jpeg when ?format=jpeg", async () => {
    dbSelectResult = [makeFakeJob()];
    mockGetImageBuffer.mockResolvedValueOnce(testPngBuffer);

    const res = await testApp.request(`/api/v1/generate/${fakeJobId}/download?format=jpeg`);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Content-Disposition")).toContain(".jpg");

    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe("jpeg");
  });

  test("normalizes 'jpg' to 'jpeg' internally", async () => {
    dbSelectResult = [makeFakeJob()];
    mockGetImageBuffer.mockResolvedValueOnce(testPngBuffer);

    const res = await testApp.request(`/api/v1/generate/${fakeJobId}/download?format=jpg`);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  test("returns 400 for invalid format", async () => {
    dbSelectResult = [makeFakeJob()];

    const res = await testApp.request(`/api/v1/generate/${fakeJobId}/download?format=tiff`);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Formato inválido");
  });

  test("returns 404 when processedS3Key is null", async () => {
    dbSelectResult = [makeFakeJob({ processedS3Key: null })];

    const res = await testApp.request(`/api/v1/generate/${fakeJobId}/download`);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns 404 for nonexistent job", async () => {
    dbSelectResult = [];

    const res = await testApp.request(`/api/v1/generate/00000000-0000-0000-0000-000000000000/download`);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ── GET /cost/custom ──────────────────────────────────────────────
describe("GET /api/v1/generate/cost/custom", () => {
  test("returns cost for valid custom dimensions (1920x1080, photorealistic)", async () => {
    const res = await testApp.request(
      "/api/v1/generate/cost/custom?width=1920&height=1080&style=photorealistic",
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.width).toBe(1920);
    expect(body.height).toBe(1080);
    expect(body.style).toBe("photorealistic");
    expect(body.model).toBe("flux2_pro");
    expect(body.generationSize).toBe("1920x1088");
    expect(body.targetSize).toBe("1920x1080");
    expect(body.estimatedCostUsd).toBeGreaterThan(0);
    expect(body.needsTransparency).toBe(false);
  });

  test("returns correct model for logo style", async () => {
    const res = await testApp.request(
      "/api/v1/generate/cost/custom?width=512&height=512&style=logo",
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.style).toBe("logo");
    expect(body.model).toBe("recraft_v3");
  });

  test("rejects dimensions below 16", async () => {
    const res = await testApp.request(
      "/api/v1/generate/cost/custom?width=10&height=100",
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("16");
  });

  test("rejects dimensions above 4096", async () => {
    const res = await testApp.request(
      "/api/v1/generate/cost/custom?width=5000&height=1000",
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("4096");
  });

  test("rejects megapixels above 4.2", async () => {
    // 4096 x 4096 = 16.7 MP > 4.2 MP
    const res = await testApp.request(
      "/api/v1/generate/cost/custom?width=4096&height=4096",
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("4.2MP");
  });
});
