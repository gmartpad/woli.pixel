import { describe, test, expect, beforeAll, mock } from "bun:test";
import sharp from "sharp";

// ── Test fixtures ────────────────────────────────────────────────
let testPngBuffer: Buffer;
const fakeCropId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

beforeAll(async () => {
  testPngBuffer = await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 128, b: 255 } },
  })
    .png()
    .toBuffer();
});

// ── Mock DB ──────────────────────────────────────────────────────
const mockInsertReturning = mock(() =>
  Promise.resolve([{ id: fakeCropId }]),
);
const mockUpdateWhere = mock(() => Promise.resolve());

mock.module("../db", () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: mockInsertReturning,
      }),
    }),
    update: () => ({
      set: () => ({
        where: mockUpdateWhere,
      }),
    }),
  },
}));

// ── Mock storage ─────────────────────────────────────────────────
mock.module("../services/storage", () => ({
  storeCropOriginal: async () => "crops/fake/original.png",
  storeCropResult: async () => "crops/fake/cropped.png",
}));

mock.module("../lib/s3", () => ({
  createPresignedDownloadUrl: async () => "https://s3.example.com/presigned-url",
}));

// ── Mock AI services (imported transitively) ─────────────────────
mock.module("../services/ai", () => ({
  analyzeImage: async () => ({}),
  generateExplanation: async () => "",
  analyzeModeration: async () => ({ analysis: "", suggestedPrompt: "" }),
}));

// ── Import AFTER mocking ─────────────────────────────────────────
const { Hono } = await import("hono");
const { cropRouter } = await import("./crop");

const testApp = new Hono();
testApp.route("/api/v1/crop", cropRouter);

// ── Helper to build multipart form data ──────────────────────────
function buildCropFormData(overrides: {
  original?: File | null;
  cropped?: File | null;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
} = {}) {
  const form = new FormData();

  const originalFile = overrides.original !== undefined
    ? overrides.original
    : new File([testPngBuffer], "photo.png", { type: "image/png" });
  const croppedFile = overrides.cropped !== undefined
    ? overrides.cropped
    : new File([testPngBuffer], "photo-cropped.png", { type: "image/png" });

  if (originalFile) form.append("original", originalFile);
  if (croppedFile) form.append("cropped", croppedFile);
  form.append("crop_x", String(overrides.cropX ?? 10));
  form.append("crop_y", String(overrides.cropY ?? 20));
  form.append("crop_w", String(overrides.cropW ?? 100));
  form.append("crop_h", String(overrides.cropH ?? 100));

  return form;
}

// ── Tests ────────────────────────────────────────────────────────
describe("POST /api/v1/crop", () => {
  test("returns 200 with id and download_url for valid request", async () => {
    const form = buildCropFormData();

    const res = await testApp.request("/api/v1/crop", {
      method: "POST",
      body: form,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(fakeCropId);
    expect(body.download_url).toBe("https://s3.example.com/presigned-url");
  });

  test("returns 400 when original file is missing", async () => {
    const form = new FormData();
    form.append("cropped", new File([testPngBuffer], "cropped.png", { type: "image/png" }));
    form.append("crop_x", "0");
    form.append("crop_y", "0");
    form.append("crop_w", "100");
    form.append("crop_h", "100");

    const res = await testApp.request("/api/v1/crop", {
      method: "POST",
      body: form,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("obrigatórios");
  });

  test("returns 400 when cropped file is missing", async () => {
    const form = new FormData();
    form.append("original", new File([testPngBuffer], "photo.png", { type: "image/png" }));
    form.append("crop_x", "0");
    form.append("crop_y", "0");
    form.append("crop_w", "100");
    form.append("crop_h", "100");

    const res = await testApp.request("/api/v1/crop", {
      method: "POST",
      body: form,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("obrigatórios");
  });

  test("returns 400 for unsupported image format", async () => {
    const bmpFile = new File([new Uint8Array(100)], "photo.bmp", { type: "image/bmp" });
    const form = buildCropFormData({ original: bmpFile });

    const res = await testApp.request("/api/v1/crop", {
      method: "POST",
      body: form,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("não suportado");
  });

  test("returns 400 when crop width is zero", async () => {
    const form = buildCropFormData({ cropW: 0 });

    const res = await testApp.request("/api/v1/crop", {
      method: "POST",
      body: form,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("inválidas");
  });

  test("returns 400 when crop height is zero", async () => {
    const form = buildCropFormData({ cropH: 0 });

    const res = await testApp.request("/api/v1/crop", {
      method: "POST",
      body: form,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("inválidas");
  });

  test("returns 400 when crop dimensions are negative", async () => {
    const form = buildCropFormData({ cropW: -50, cropH: -50 });

    const res = await testApp.request("/api/v1/crop", {
      method: "POST",
      body: form,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("inválidas");
  });

  test("returns 500 with descriptive error when DB insert fails", async () => {
    mockInsertReturning.mockRejectedValueOnce(new Error("DB connection failed"));

    const form = buildCropFormData();
    const res = await testApp.request("/api/v1/crop", {
      method: "POST",
      body: form,
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Falha ao processar");
  });
});
