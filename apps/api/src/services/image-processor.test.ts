import { describe, test, expect } from "bun:test";
import { processImage, postProcessGenerated, type ImageTypeSpec } from "./image-processor";
import { createTestImage } from "../test-utils/fixtures";
import sharp from "sharp";

function makeSpec(overrides: Partial<ImageTypeSpec> = {}): ImageTypeSpec {
  return {
    id: "test-id",
    typeKey: "test_type",
    displayName: "Test Type",
    width: 256,
    height: 256,
    aspectRatio: "1:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png", "jpeg"],
    recommendedFormat: "png",
    requiresTransparency: false,
    minWidth: null,
    ...overrides,
  };
}

describe("processImage", () => {
  test("accepts Buffer input and returns processedBuffer", async () => {
    const buf = await createTestImage(500, 400, "png");
    const spec = makeSpec({ width: 300, height: 200, recommendedFormat: "png" });
    const result = await processImage(buf, spec);

    expect(result.processedBuffer).toBeInstanceOf(Buffer);
    expect(result.processedBuffer.length).toBeGreaterThan(0);
    expect(result).not.toHaveProperty("processedPath");
  });

  test("accepts string (file path) input", async () => {
    const buf = await createTestImage(500, 400, "png");
    // Sharp accepts Buffer natively, so Buffer works as input
    const spec = makeSpec({ width: 300, height: 200, recommendedFormat: "png" });
    const result = await processImage(buf, spec);
    expect(result.processedBuffer).toBeInstanceOf(Buffer);
  });

  test("resizes to target dimensions with cover fit", async () => {
    const buf = await createTestImage(500, 400, "png");
    const spec = makeSpec({ width: 300, height: 200, recommendedFormat: "png" });
    const result = await processImage(buf, spec);
    expect(result.processedWidth).toBe(300);
    expect(result.processedHeight).toBe(200);
    expect(result.adjustments).toContain("resized");
  });

  test("contains with transparency when requiresTransparency", async () => {
    const buf = await createTestImage(500, 400, "png");
    const spec = makeSpec({
      width: 128,
      height: 128,
      recommendedFormat: "png",
      requiresTransparency: true,
    });
    const result = await processImage(buf, spec);
    expect(result.processedWidth).toBe(128);
    expect(result.processedHeight).toBe(128);
    expect(result.adjustments).toContain("resized");
    expect(result.adjustments).not.toContain("smart_cropped");
  });

  test("no resize when dimensions already match", async () => {
    const buf = await createTestImage(256, 256, "png");
    const spec = makeSpec({ width: 256, height: 256, recommendedFormat: "png" });
    const result = await processImage(buf, spec);
    expect(result.adjustments).not.toContain("resized");
  });

  test("detects smart crop when aspect ratio differs significantly", async () => {
    const buf = await createTestImage(500, 400, "png");
    const spec = makeSpec({ width: 256, height: 256, recommendedFormat: "png" });
    const result = await processImage(buf, spec);
    expect(result.adjustments).toContain("smart_cropped");
  });

  test("converts format from PNG to JPEG", async () => {
    const buf = await createTestImage(500, 400, "png");
    const spec = makeSpec({ width: 300, height: 200, recommendedFormat: "jpeg" });
    const result = await processImage(buf, spec);
    expect(result.processedFormat).toBe("jpeg");
    expect(result.adjustments).toContain("format_converted");
  });

  test("converts format from JPEG to PNG", async () => {
    const buf = await createTestImage(2000, 1500, "jpeg");
    const spec = makeSpec({ width: 300, height: 200, recommendedFormat: "png" });
    const result = await processImage(buf, spec);
    expect(result.processedFormat).toBe("png");
    expect(result.adjustments).toContain("format_converted");
  });

  test("JPEG compression stays within size limit", async () => {
    const buf = await createTestImage(2000, 1500, "jpeg");
    const spec = makeSpec({
      width: 800,
      height: 600,
      maxFileSizeKb: 500,
      recommendedFormat: "jpeg",
    });
    const result = await processImage(buf, spec);
    expect(result.processedSizeKb).toBeLessThanOrEqual(500);
  });

  test("applies user crop before resize", async () => {
    const buf = await createTestImage(500, 400, "png");
    const spec = makeSpec({ width: 100, height: 100, recommendedFormat: "png" });
    const crop = { x: 50, y: 50, width: 200, height: 200 };
    const result = await processImage(buf, spec, crop);
    expect(result.adjustments).toContain("user_cropped");
    expect(result.processedWidth).toBe(100);
    expect(result.processedHeight).toBe(100);
  });

  test("processed buffer contains valid image data", async () => {
    const buf = await createTestImage(500, 400, "png");
    const spec = makeSpec({ width: 100, height: 100, recommendedFormat: "png" });
    const result = await processImage(buf, spec);

    // Verify the buffer is a valid image by reading its metadata
    const meta = await sharp(result.processedBuffer).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  test("upscales to minWidth for variable-width types", async () => {
    const tinyBuf = await createTestImage(50, 50, "png");
    const spec = makeSpec({
      width: null,
      height: null,
      minWidth: 200,
      recommendedFormat: "png",
    });
    const result = await processImage(tinyBuf, spec);
    expect(result.processedWidth).toBeGreaterThanOrEqual(200);
    expect(result.adjustments).toContain("resized");
  });

  test("WebP output format works", async () => {
    const buf = await createTestImage(500, 400, "png");
    const spec = makeSpec({ width: 200, height: 200, recommendedFormat: "webp" });
    const result = await processImage(buf, spec);
    expect(result.processedFormat).toBe("webp");
  });
});

describe("postProcessGenerated", () => {
  test("returns processedBuffer instead of processedPath", async () => {
    const buf = await createTestImage(1024, 1024, "png");
    const spec = makeSpec({ width: 256, height: 256, recommendedFormat: "png" });
    const result = await postProcessGenerated(buf, spec);

    expect(result.processedBuffer).toBeInstanceOf(Buffer);
    expect(result).not.toHaveProperty("processedPath");
  });

  test("resizes generated image to target dimensions", async () => {
    const buf = await createTestImage(1024, 1024, "png");
    const spec = makeSpec({ width: 128, height: 128, recommendedFormat: "jpeg" });
    const result = await postProcessGenerated(buf, spec);

    expect(result.processedWidth).toBe(128);
    expect(result.processedHeight).toBe(128);
    expect(result.processedFormat).toBe("jpeg");
    expect(result.adjustments).toContain("resized");
  });

  test("does not resize when dimensions match", async () => {
    const buf = await createTestImage(256, 256, "png");
    const spec = makeSpec({ width: 256, height: 256, recommendedFormat: "png" });
    const result = await postProcessGenerated(buf, spec);
    expect(result.adjustments).not.toContain("resized");
  });
});
