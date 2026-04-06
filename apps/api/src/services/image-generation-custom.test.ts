import { describe, test, expect } from "bun:test";
import {
  resolveModelForCustom,
  resolveGenerationSizeCustom,
  estimateCostCustom,
} from "./image-generation";

describe("resolveModelForCustom", () => {
  test("returns flux2_pro for photorealistic", () => {
    expect(resolveModelForCustom("photorealistic")).toBe("flux2_pro");
  });
  test("returns recraft_v3 for logo", () => {
    expect(resolveModelForCustom("logo")).toBe("recraft_v3");
  });
  test("returns recraft_v3 for illustration", () => {
    expect(resolveModelForCustom("illustration")).toBe("recraft_v3");
  });
  test("returns recraft_v3 for auto with small square (128x128)", () => {
    expect(resolveModelForCustom("auto", 128, 128)).toBe("recraft_v3");
  });
  test("returns flux2_pro for auto with large square (1024x1024)", () => {
    expect(resolveModelForCustom("auto", 1024, 1024)).toBe("flux2_pro");
  });
  test("returns flux2_pro for auto with landscape", () => {
    expect(resolveModelForCustom("auto", 1920, 1080)).toBe("flux2_pro");
  });
  test("returns recraft_v3 for auto with no dimensions (defaults)", () => {
    expect(resolveModelForCustom("auto")).toBe("recraft_v3");
  });
});

describe("resolveGenerationSizeCustom", () => {
  test("returns 1024x1024 for recraft_v3", () => {
    expect(resolveGenerationSizeCustom(500, 300, "recraft_v3")).toEqual({ w: 1024, h: 1024 });
  });
  test("rounds up to 16px multiples for flux2_pro", () => {
    const size = resolveGenerationSizeCustom(1920, 1080, "flux2_pro");
    expect(size.w % 16).toBe(0);
    expect(size.h % 16).toBe(0);
    expect(size.w).toBeGreaterThanOrEqual(1920);
    expect(size.h).toBeGreaterThanOrEqual(1080);
  });
  test("keeps exact dims if already multiples of 16", () => {
    expect(resolveGenerationSizeCustom(1024, 768, "flux2_pro")).toEqual({ w: 1024, h: 768 });
  });
});

describe("estimateCostCustom", () => {
  test("recraft base cost for logo", () => {
    expect(estimateCostCustom(128, 128, "logo", false)).toBe(0.04);
  });
  test("recraft with transparency", () => {
    expect(estimateCostCustom(128, 128, "logo", true)).toBe(0.05);
  });
  test("flux cost based on megapixels", () => {
    const cost = estimateCostCustom(1920, 1080, "photorealistic", false);
    expect(cost).toBeGreaterThan(0.03);
  });
});
