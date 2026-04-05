import { describe, test, expect } from "bun:test";
import { evaluateGate } from "./quality-gate";
import type { GateConfig, AnalysisInput, ImageMeta } from "./quality-gate";
import type { BrandConsistencyResult } from "./color-analysis";

// ── Helpers ──────────────────────────────────────

function baseConfig(overrides?: Partial<GateConfig>): GateConfig {
  return {
    minQualityScore: 5,
    maxFileSizeKb: null,
    requireNoBlur: false,
    requireNoLowResolution: false,
    requireMinWidth: null,
    requireMinHeight: null,
    allowedContentTypes: null,
    blockedContentTypes: null,
    ...overrides,
  };
}

function baseAnalysis(overrides?: Partial<AnalysisInput>): AnalysisInput {
  return {
    quality: {
      score: 8,
      blur_detected: false,
      low_resolution: false,
      ...overrides?.quality,
    },
    content: {
      type: "photo",
      ...overrides?.content,
    },
  };
}

function baseMeta(overrides?: Partial<ImageMeta>): ImageMeta {
  return {
    width: 1920,
    height: 1080,
    sizeKb: 500,
    ...overrides,
  };
}

function baseBrandResult(overrides?: Partial<BrandConsistencyResult>): BrandConsistencyResult {
  return {
    score: 80,
    issues: [],
    color_matches: [],
    has_forbidden_colors: false,
    forbidden_matches: [],
    ...overrides,
  };
}

// ── evaluateGate ─────────────────────────────────

describe("evaluateGate", () => {
  // 1. All checks pass
  test("all checks pass -> verdict 'pass'", () => {
    const result = evaluateGate(baseConfig(), baseAnalysis(), baseMeta());
    expect(result.verdict).toBe("pass");
    expect(result.failures).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  // 2. Score below minimum
  test("score below minimum -> 'fail' with score failure text", () => {
    const result = evaluateGate(
      baseConfig({ minQualityScore: 7 }),
      baseAnalysis({ quality: { score: 4, blur_detected: false, low_resolution: false } }),
      baseMeta()
    );
    expect(result.verdict).toBe("fail");
    expect(result.failures.some((f) => f.includes("Score") || f.includes("score"))).toBe(true);
    expect(result.details.score_check.passed).toBe(false);
  });

  // 3. Blur detected when requireNoBlur
  test("blur detected with requireNoBlur -> 'fail'", () => {
    const result = evaluateGate(
      baseConfig({ requireNoBlur: true }),
      baseAnalysis({ quality: { score: 8, blur_detected: true, low_resolution: false } }),
      baseMeta()
    );
    expect(result.verdict).toBe("fail");
    expect(result.failures.some((f) => f.toLowerCase().includes("blur") || f.toLowerCase().includes("desfoque"))).toBe(true);
    expect(result.details.blur_check.passed).toBe(false);
  });

  // 4. Low resolution when requireNoLowResolution
  test("low resolution with requireNoLowResolution -> 'fail'", () => {
    const result = evaluateGate(
      baseConfig({ requireNoLowResolution: true }),
      baseAnalysis({ quality: { score: 8, blur_detected: false, low_resolution: true } }),
      baseMeta()
    );
    expect(result.verdict).toBe("fail");
    expect(result.failures.some((f) => f.toLowerCase().includes("resolu"))).toBe(true);
    expect(result.details.resolution_check.passed).toBe(false);
  });

  // 5. Width below requireMinWidth
  test("width below requireMinWidth -> 'fail'", () => {
    const result = evaluateGate(
      baseConfig({ requireMinWidth: 1920 }),
      baseAnalysis(),
      baseMeta({ width: 800 })
    );
    expect(result.verdict).toBe("fail");
    expect(result.failures.some((f) => f.includes("800"))).toBe(true);
    expect(result.details.dimension_check?.passed).toBe(false);
  });

  // 6. Height below requireMinHeight
  test("height below requireMinHeight -> 'fail'", () => {
    const result = evaluateGate(
      baseConfig({ requireMinHeight: 1080 }),
      baseAnalysis(),
      baseMeta({ height: 400 })
    );
    expect(result.verdict).toBe("fail");
    expect(result.failures.some((f) => f.includes("400"))).toBe(true);
    expect(result.details.dimension_check?.passed).toBe(false);
  });

  // 7. Content type not in whitelist
  test("content type not in whitelist -> 'fail'", () => {
    const result = evaluateGate(
      baseConfig({ allowedContentTypes: ["icon", "logo"] }),
      baseAnalysis({ content: { type: "photo" } }),
      baseMeta()
    );
    expect(result.verdict).toBe("fail");
    expect(result.failures.some((f) => f.includes("photo"))).toBe(true);
    expect(result.details.content_type_check?.passed).toBe(false);
  });

  // 8. Content type in blacklist
  test("content type in blacklist -> 'fail'", () => {
    const result = evaluateGate(
      baseConfig({ blockedContentTypes: ["meme", "screenshot"] }),
      baseAnalysis({ content: { type: "meme" } }),
      baseMeta()
    );
    expect(result.verdict).toBe("fail");
    expect(result.failures.some((f) => f.includes("meme"))).toBe(true);
    expect(result.details.content_type_check?.passed).toBe(false);
  });

  // 9. File size exceeds maxFileSizeKb
  test("file size exceeds maxFileSizeKb -> 'fail'", () => {
    const result = evaluateGate(
      baseConfig({ maxFileSizeKb: 200 }),
      baseAnalysis(),
      baseMeta({ sizeKb: 500 })
    );
    expect(result.verdict).toBe("fail");
    expect(result.failures.some((f) => f.includes("500"))).toBe(true);
    expect(result.details.file_size_check?.passed).toBe(false);
  });

  // 10. Multiple failures collected
  test("multiple failures -> 'fail' with 3+ failures", () => {
    const result = evaluateGate(
      baseConfig({
        minQualityScore: 9,
        requireNoBlur: true,
        requireNoLowResolution: true,
      }),
      baseAnalysis({
        quality: { score: 3, blur_detected: true, low_resolution: true },
      }),
      baseMeta()
    );
    expect(result.verdict).toBe("fail");
    expect(result.failures.length).toBeGreaterThanOrEqual(3);
  });

  // 11. Brand score < 60 -> verdict 'warn'
  test("brand score < 60 -> verdict 'warn' with brand warning", () => {
    const result = evaluateGate(
      baseConfig(),
      baseAnalysis(),
      baseMeta(),
      baseBrandResult({ score: 40 })
    );
    expect(result.verdict).toBe("warn");
    expect(result.warnings.some((w) => w.includes("marca") || w.includes("brand") || w.includes("40"))).toBe(true);
    expect(result.details.brand_check?.passed).toBe(false);
  });

  // 12. Brand score >= 60 -> no warning
  test("brand score >= 60 -> no brand warning", () => {
    const result = evaluateGate(
      baseConfig(),
      baseAnalysis(),
      baseMeta(),
      baseBrandResult({ score: 80 })
    );
    expect(result.verdict).toBe("pass");
    expect(result.warnings).toHaveLength(0);
    expect(result.details.brand_check?.passed).toBe(true);
  });

  // 13. No brandResult -> no brand warning
  test("no brandResult provided -> no brand warning and no brand_check in details", () => {
    const result = evaluateGate(baseConfig(), baseAnalysis(), baseMeta());
    expect(result.warnings).toHaveLength(0);
    expect(result.details.brand_check).toBeUndefined();
  });

  // 14. Whitelist/blacklist empty -> passes content type check
  test("empty allowedContentTypes and blockedContentTypes -> passes content type", () => {
    const result = evaluateGate(
      baseConfig({ allowedContentTypes: [], blockedContentTypes: [] }),
      baseAnalysis({ content: { type: "anything_goes" } }),
      baseMeta()
    );
    expect(result.verdict).toBe("pass");
    expect(result.failures).toHaveLength(0);
    // content_type_check should not be set when lists are empty
    expect(result.details.content_type_check).toBeUndefined();
  });

  // 15. Details include per-check breakdown
  test("details include per-check breakdown with required/actual/passed", () => {
    const config = baseConfig({
      minQualityScore: 5,
      requireNoBlur: true,
      requireNoLowResolution: false,
      requireMinWidth: 800,
      requireMinHeight: 600,
      maxFileSizeKb: 1000,
      allowedContentTypes: ["photo"],
    });
    const analysis = baseAnalysis({
      quality: { score: 8, blur_detected: false, low_resolution: false },
      content: { type: "photo" },
    });
    const meta = baseMeta({ width: 1920, height: 1080, sizeKb: 500 });
    const brand = baseBrandResult({ score: 90 });

    const result = evaluateGate(config, analysis, meta, brand);

    // score_check
    expect(result.details.score_check).toEqual({
      required: 5,
      actual: 8,
      passed: true,
    });

    // blur_check
    expect(result.details.blur_check).toEqual({
      required: true,
      actual: false,
      passed: true,
    });

    // resolution_check
    expect(result.details.resolution_check).toEqual({
      required: false,
      actual: false,
      passed: true,
    });

    // dimension_check
    expect(result.details.dimension_check).toBeDefined();
    expect(result.details.dimension_check!.passed).toBe(true);

    // content_type_check
    expect(result.details.content_type_check).toBeDefined();
    expect(result.details.content_type_check!.passed).toBe(true);

    // file_size_check
    expect(result.details.file_size_check).toBeDefined();
    expect(result.details.file_size_check!.passed).toBe(true);

    // brand_check
    expect(result.details.brand_check).toBeDefined();
    expect(result.details.brand_check!.passed).toBe(true);
  });
});
