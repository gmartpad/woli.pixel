import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { processImage, type ImageTypeSpec } from "./image-processor";
import { createTestImage } from "../test-utils/fixtures";
import sharp from "sharp";
import path from "path";
import { mkdir, rm } from "fs/promises";

const TEST_DIR = path.join(process.cwd(), "uploads", "__test__");
let testImagePath: string;
let largeImagePath: string;

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

beforeAll(async () => {
  await mkdir(TEST_DIR, { recursive: true });

  // Create a standard test image (500x400 PNG)
  const buf = await createTestImage(500, 400, "png");
  testImagePath = path.join(TEST_DIR, "test-input.png");
  await Bun.write(testImagePath, buf);

  // Create a large test image (2000x1500 JPEG)
  const largeBuf = await createTestImage(2000, 1500, "jpeg");
  largeImagePath = path.join(TEST_DIR, "test-large.jpg");
  await Bun.write(largeImagePath, largeBuf);
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("processImage", () => {
  test("resizes to target dimensions with cover fit", async () => {
    const spec = makeSpec({ width: 300, height: 200, recommendedFormat: "png" });
    const result = await processImage(testImagePath, spec);
    expect(result.processedWidth).toBe(300);
    expect(result.processedHeight).toBe(200);
    expect(result.adjustments).toContain("resized");
  });

  test("contains with transparency when requiresTransparency", async () => {
    const spec = makeSpec({
      width: 128,
      height: 128,
      recommendedFormat: "png",
      requiresTransparency: true,
    });
    const result = await processImage(testImagePath, spec);
    expect(result.processedWidth).toBe(128);
    expect(result.processedHeight).toBe(128);
    expect(result.adjustments).toContain("resized");
    // Contain fit doesn't crop, so no smart_cropped
    expect(result.adjustments).not.toContain("smart_cropped");
  });

  test("no resize when dimensions already match", async () => {
    // Create an image that exactly matches target
    const buf = await createTestImage(256, 256, "png");
    const exactPath = path.join(TEST_DIR, "exact.png");
    await Bun.write(exactPath, buf);

    const spec = makeSpec({ width: 256, height: 256, recommendedFormat: "png" });
    const result = await processImage(exactPath, spec);
    expect(result.adjustments).not.toContain("resized");
  });

  test("detects smart crop when aspect ratio differs significantly", async () => {
    // 500x400 (5:4) → 256x256 (1:1) — ratio differs by > 0.1
    const spec = makeSpec({ width: 256, height: 256, recommendedFormat: "png" });
    const result = await processImage(testImagePath, spec);
    expect(result.adjustments).toContain("smart_cropped");
  });

  test("converts format from PNG to JPEG", async () => {
    const spec = makeSpec({ width: 300, height: 200, recommendedFormat: "jpeg" });
    const result = await processImage(testImagePath, spec);
    expect(result.processedFormat).toBe("jpeg");
    expect(result.adjustments).toContain("format_converted");
  });

  test("converts format from JPEG to PNG", async () => {
    const spec = makeSpec({ width: 300, height: 200, recommendedFormat: "png" });
    const result = await processImage(largeImagePath, spec);
    expect(result.processedFormat).toBe("png");
    expect(result.adjustments).toContain("format_converted");
  });

  test("JPEG compression stays within size limit", async () => {
    const spec = makeSpec({
      width: 800,
      height: 600,
      maxFileSizeKb: 500,
      recommendedFormat: "jpeg",
    });
    const result = await processImage(largeImagePath, spec);
    expect(result.processedSizeKb).toBeLessThanOrEqual(500);
  });

  test("applies user crop before resize", async () => {
    const spec = makeSpec({ width: 100, height: 100, recommendedFormat: "png" });
    const crop = { x: 50, y: 50, width: 200, height: 200 };
    const result = await processImage(testImagePath, spec, crop);
    expect(result.adjustments).toContain("user_cropped");
    expect(result.processedWidth).toBe(100);
    expect(result.processedHeight).toBe(100);
  });

  test("output file is written to disk", async () => {
    const spec = makeSpec({ width: 100, height: 100, recommendedFormat: "png" });
    const result = await processImage(testImagePath, spec);
    const file = Bun.file(result.processedPath);
    expect(await file.exists()).toBe(true);
    expect(result.processedSizeKb).toBeGreaterThanOrEqual(0);
  });

  test("upscales to minWidth for variable-width types", async () => {
    // Create a tiny image
    const tinyBuf = await createTestImage(50, 50, "png");
    const tinyPath = path.join(TEST_DIR, "tiny.png");
    await Bun.write(tinyPath, tinyBuf);

    const spec = makeSpec({
      width: null,
      height: null,
      minWidth: 200,
      recommendedFormat: "png",
    });
    const result = await processImage(tinyPath, spec);
    expect(result.processedWidth).toBeGreaterThanOrEqual(200);
    expect(result.adjustments).toContain("resized");
  });

  test("WebP output format works", async () => {
    const spec = makeSpec({ width: 200, height: 200, recommendedFormat: "webp" });
    const result = await processImage(testImagePath, spec);
    expect(result.processedFormat).toBe("webp");
  });
});
