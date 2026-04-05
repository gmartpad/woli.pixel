import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { createTestImage, createTransparentTestImage } from "../test-utils/fixtures";
import { analyzeTransparency } from "./transparency-validator";

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "pixel-transparency-test-"));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("analyzeTransparency", () => {
  test("transparent PNG has alpha channel and transparency > 0%", async () => {
    const buffer = await createTransparentTestImage(200, 200);
    const filePath = join(tempDir, "transparent.png");
    await Bun.write(filePath, buffer);

    const result = await analyzeTransparency(filePath);

    expect(result.has_alpha_channel).toBe(true);
    expect(result.transparency_percentage).toBeGreaterThan(0);
  });

  test("opaque JPEG has no alpha channel and 0% transparency", async () => {
    const buffer = await createTestImage(200, 200, "jpeg");
    const filePath = join(tempDir, "opaque.jpg");
    await Bun.write(filePath, buffer);

    const result = await analyzeTransparency(filePath);

    expect(result.has_alpha_channel).toBe(false);
    expect(result.transparency_percentage).toBe(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  test("opaque PNG (no alpha) has no alpha channel and 0% transparency", async () => {
    const buffer = await createTestImage(200, 200, "png", { hasAlpha: false });
    const filePath = join(tempDir, "opaque.png");
    await Bun.write(filePath, buffer);

    const result = await analyzeTransparency(filePath);

    expect(result.has_alpha_channel).toBe(false);
    expect(result.transparency_percentage).toBe(0);
  });

  test("PNG with transparent edges detects edge_transparency", async () => {
    // createTransparentTestImage makes a center rectangle with transparent edges
    const buffer = await createTransparentTestImage(200, 200);
    const filePath = join(tempDir, "transparent-edges.png");
    await Bun.write(filePath, buffer);

    const result = await analyzeTransparency(filePath);

    expect(result.has_alpha_channel).toBe(true);
    expect(result.edge_transparency).toBe(true);
  });

  test("fully opaque PNG with alpha channel reports 0% transparency", async () => {
    // Create a PNG with alpha channel but all pixels fully opaque
    const buffer = await createTestImage(200, 200, "png", { hasAlpha: true });
    const filePath = join(tempDir, "opaque-with-alpha.png");
    await Bun.write(filePath, buffer);

    const result = await analyzeTransparency(filePath);

    expect(result.has_alpha_channel).toBe(true);
    expect(result.transparency_percentage).toBe(0);
    expect(result.background_is_solid).toBe(true);
  });

  test("transparent image reports background_is_solid for centered rectangle", async () => {
    const buffer = await createTransparentTestImage(200, 200);
    const filePath = join(tempDir, "centered-rect.png");
    await Bun.write(filePath, buffer);

    const result = await analyzeTransparency(filePath);

    // The inner rectangle should be detected as a solid background shape
    expect(result.background_is_solid).toBe(true);
    expect(result.transparency_percentage).toBeGreaterThan(0);
    expect(result.transparency_percentage).toBeLessThan(100);
  });
});
