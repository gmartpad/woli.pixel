import { describe, it, expect } from "vitest";
import { matchImageToType, matchBatchImages } from "./match-image-type";
import type { ImageTypeCandidate } from "./match-image-type";

// Subset of the 19 real presets — covers all aspect ratio families
const TYPES: ImageTypeCandidate[] = [
  { id: "conteudo_imagem", width: 1920, height: 1080 },   // 16:9
  { id: "fundo_workspace", width: 1920, height: 1080 },   // 16:9
  { id: "fundo_login", width: 1600, height: 900 },        // 16:9
  { id: "fundo_login_mobile", width: 375, height: 820 },  // ~9:20 portrait
  { id: "capa_workspace", width: 300, height: 300 },      // 1:1
  { id: "icone_recompensa", width: 200, height: 200 },    // 1:1
  { id: "favicon", width: 128, height: 128 },             // 1:1
  { id: "icone_curso", width: 256, height: 256 },         // 1:1
  { id: "testeira_email", width: 600, height: 100 },      // 6:1 ultra-wide
  { id: "logo_relatorios", width: 650, height: 200 },     // 3.25:1
  { id: "banner_campanha", width: 1200, height: 300 },    // 4:1
  { id: "logo_topo", width: null, height: null },          // variable
  { id: "logo_app", width: null, height: null },           // variable
];

describe("matchImageToType", () => {
  it("returns exact match with score ≈ 1.0", () => {
    const result = matchImageToType(1920, 1080, TYPES);
    expect(result).not.toBeNull();
    expect(result!.typeId).toBe("conteudo_imagem");
    expect(result!.matchScore).toBeGreaterThanOrEqual(0.99);
  });

  it("prefers same aspect ratio over same area (AR weighs 70%)", () => {
    // 960×540 is 16:9 small — should prefer a 16:9 type over 300×300 square
    const result = matchImageToType(960, 540, TYPES);
    expect(result).not.toBeNull();
    const ar = ["conteudo_imagem", "fundo_workspace", "fundo_login"];
    expect(ar).toContain(result!.typeId);
  });

  it("matches square image to closest square type", () => {
    const result = matchImageToType(200, 200, TYPES);
    expect(result).not.toBeNull();
    expect(result!.typeId).toBe("icone_recompensa");
    expect(result!.matchScore).toBeGreaterThanOrEqual(0.99);
  });

  it("matches portrait image to portrait type", () => {
    const result = matchImageToType(375, 820, TYPES);
    expect(result).not.toBeNull();
    expect(result!.typeId).toBe("fundo_login_mobile");
    expect(result!.matchScore).toBeGreaterThanOrEqual(0.99);
  });

  it("matches ultra-wide image to ultra-wide type", () => {
    const result = matchImageToType(600, 100, TYPES);
    expect(result).not.toBeNull();
    expect(result!.typeId).toBe("testeira_email");
    expect(result!.matchScore).toBeGreaterThanOrEqual(0.99);
  });

  it("falls back to variable-dimension type for extremely unusual ratio", () => {
    // 10×1000 — extremely tall, no fixed type is close
    const result = matchImageToType(10, 1000, TYPES);
    expect(result).not.toBeNull();
    expect(["logo_topo", "logo_app"]).toContain(result!.typeId);
    expect(result!.matchScore).toBeCloseTo(0.2, 1);
  });

  it("returns null for 0×0 image", () => {
    const result = matchImageToType(0, 0, TYPES);
    expect(result).toBeNull();
  });

  it("returns null for empty types array", () => {
    const result = matchImageToType(1920, 1080, []);
    expect(result).toBeNull();
  });

  it("handles single-pixel dimension gracefully", () => {
    const result = matchImageToType(1, 1, TYPES);
    expect(result).not.toBeNull();
    // Should match a square type (smallest area wins area component)
  });

  it("picks closer area match among same-AR types", () => {
    // 130×130 is 1:1 — closer to favicon (128×128) than icone_curso (256×256) in area
    const result = matchImageToType(130, 130, TYPES);
    expect(result).not.toBeNull();
    expect(result!.typeId).toBe("favicon");
  });

  it("does not return variable type when a fixed type scores above threshold", () => {
    const result = matchImageToType(1920, 1080, TYPES);
    expect(result).not.toBeNull();
    expect(result!.typeId).not.toBe("logo_topo");
    expect(result!.typeId).not.toBe("logo_app");
  });
});

describe("matchBatchImages", () => {
  it("returns matches for each image in the batch", () => {
    const images = [
      { width: 1920, height: 1080 },
      { width: 128, height: 128 },
      { width: 375, height: 820 },
    ];
    const results = matchBatchImages(images, TYPES);
    expect(results).toHaveLength(3);
    expect(results[0]!.typeId).toBe("conteudo_imagem");
    expect(results[1]!.typeId).toBe("favicon");
    expect(results[2]!.typeId).toBe("fundo_login_mobile");
  });

  it("returns null entries for invalid images", () => {
    const images = [
      { width: 1920, height: 1080 },
      { width: 0, height: 0 },
    ];
    const results = matchBatchImages(images, TYPES);
    expect(results).toHaveLength(2);
    expect(results[0]).not.toBeNull();
    expect(results[1]).toBeNull();
  });

  it("returns empty array for empty input", () => {
    const results = matchBatchImages([], TYPES);
    expect(results).toEqual([]);
  });
});
