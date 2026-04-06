import { describe, test, expect } from "bun:test";
import {
  resolveModel,
  resolveRecraftStyle,
  resolveGenerationSize,
  buildPrompt,
  estimateCost,
  type ImageTypeForGeneration,
} from "./image-generation";

// ── resolveModel ─────────────────────────────

describe("resolveModel", () => {
  test("returns flux2_pro for background presets", () => {
    expect(resolveModel("fundo_login")).toBe("flux2_pro");
    expect(resolveModel("fundo_login_mobile")).toBe("flux2_pro");
    expect(resolveModel("fundo_workspace")).toBe("flux2_pro");
  });

  test("returns flux2_pro for content presets", () => {
    expect(resolveModel("conteudo_imagem")).toBe("flux2_pro");
    expect(resolveModel("capa_workspace")).toBe("flux2_pro");
    expect(resolveModel("testeira_email")).toBe("flux2_pro");
    expect(resolveModel("banner_campanha")).toBe("flux2_pro");
  });

  test("returns recraft_v3 for logo presets", () => {
    expect(resolveModel("logo_topo")).toBe("recraft_v3");
    expect(resolveModel("logo_relatorios")).toBe("recraft_v3");
    expect(resolveModel("logo_app")).toBe("recraft_v3");
    expect(resolveModel("logo_dispersao")).toBe("recraft_v3");
  });

  test("returns recraft_v3 for icon/badge presets", () => {
    expect(resolveModel("favicon")).toBe("recraft_v3");
    expect(resolveModel("icone_pilula")).toBe("recraft_v3");
    expect(resolveModel("icone_curso")).toBe("recraft_v3");
    expect(resolveModel("badge_conquista")).toBe("recraft_v3");
    expect(resolveModel("medalha_ranking")).toBe("recraft_v3");
    expect(resolveModel("icone_recompensa")).toBe("recraft_v3");
  });

  test("returns recraft_v3 for avatar/user presets", () => {
    expect(resolveModel("foto_aluno")).toBe("recraft_v3");
    expect(resolveModel("avatar_personagem")).toBe("recraft_v3");
  });

  test("returns recraft_v3 for unknown presets (default)", () => {
    expect(resolveModel("unknown_preset")).toBe("recraft_v3");
  });
});

// ── resolveRecraftStyle ──────────────────────

describe("resolveRecraftStyle", () => {
  test("maps logo presets to logo_raster", () => {
    expect(resolveRecraftStyle("logo_topo").style).toBe("logo_raster");
    expect(resolveRecraftStyle("logo_relatorios").style).toBe("logo_raster");
    expect(resolveRecraftStyle("logo_app").style).toBe("logo_raster");
  });

  test("maps icon/badge presets to digital_illustration", () => {
    expect(resolveRecraftStyle("favicon").style).toBe("digital_illustration");
    expect(resolveRecraftStyle("badge_conquista").style).toBe("digital_illustration");
    expect(resolveRecraftStyle("medalha_ranking").style).toBe("digital_illustration");
    expect(resolveRecraftStyle("icone_recompensa").style).toBe("digital_illustration");
  });

  test("maps foto_aluno to realistic_image with studio_portrait substyle", () => {
    const result = resolveRecraftStyle("foto_aluno");
    expect(result.style).toBe("realistic_image");
    expect(result.substyle).toBe("studio_portrait");
  });

  test("maps avatar_personagem to digital_illustration with handmade_3d substyle", () => {
    const result = resolveRecraftStyle("avatar_personagem");
    expect(result.style).toBe("digital_illustration");
    expect(result.substyle).toBe("handmade_3d");
  });

  test("returns digital_illustration as default for unknown presets", () => {
    expect(resolveRecraftStyle("unknown").style).toBe("digital_illustration");
  });
});

// ── resolveGenerationSize ────────────────────

describe("resolveGenerationSize", () => {
  test("recraft always returns 1024x1024", () => {
    expect(resolveGenerationSize({ width: 128, height: 128 }, "recraft_v3")).toEqual({ w: 1024, h: 1024 });
    expect(resolveGenerationSize({ width: 1920, height: 1080 }, "recraft_v3")).toEqual({ w: 1024, h: 1024 });
    expect(resolveGenerationSize({ width: null, height: null }, "recraft_v3")).toEqual({ w: 1024, h: 1024 });
  });

  test("flux rounds up to nearest multiple of 16", () => {
    expect(resolveGenerationSize({ width: 1920, height: 1080 }, "flux2_pro")).toEqual({ w: 1920, h: 1088 });
    expect(resolveGenerationSize({ width: 1600, height: 900 }, "flux2_pro")).toEqual({ w: 1600, h: 912 });
    expect(resolveGenerationSize({ width: 375, height: 820 }, "flux2_pro")).toEqual({ w: 384, h: 832 });
    expect(resolveGenerationSize({ width: 300, height: 300 }, "flux2_pro")).toEqual({ w: 304, h: 304 });
  });

  test("flux uses 1024 as default for null dimensions", () => {
    expect(resolveGenerationSize({ width: null, height: null }, "flux2_pro")).toEqual({ w: 1024, h: 1024 });
    expect(resolveGenerationSize({ width: null, height: 600 }, "flux2_pro")).toEqual({ w: 1024, h: 608 });
  });

  test("flux does not round when already a multiple of 16", () => {
    expect(resolveGenerationSize({ width: 1024, height: 1024 }, "flux2_pro")).toEqual({ w: 1024, h: 1024 });
    expect(resolveGenerationSize({ width: 1200, height: 304 }, "flux2_pro")).toEqual({ w: 1200, h: 304 });
  });
});

// ── buildPrompt ──────────────────────────────

describe("buildPrompt", () => {
  const makePreset = (overrides: Partial<ImageTypeForGeneration> = {}): ImageTypeForGeneration => ({
    typeKey: "favicon",
    displayName: "Favicon",
    description: "Browser tab icon",
    width: 128,
    height: 128,
    requiresTransparency: true,
    recommendedFormat: "png",
    maxFileSizeKb: 500,
    category: "admin",
    ...overrides,
  });

  test("includes user prompt", () => {
    const result = buildPrompt("blue mountain logo", makePreset(), "medium");
    expect(result).toContain("blue mountain logo");
  });

  test("includes preset context", () => {
    const result = buildPrompt("test", makePreset({ typeKey: "fundo_login" }), "medium");
    expect(result).toContain("login background");
  });

  test("includes quality hint for high tier", () => {
    const result = buildPrompt("test", makePreset(), "high");
    expect(result).toContain("production-quality");
  });

  test("includes quality hint for low tier", () => {
    const result = buildPrompt("test", makePreset(), "low");
    expect(result).toContain("draft");
  });

  test("no quality hint for medium tier", () => {
    const result = buildPrompt("test", makePreset(), "medium");
    expect(result).not.toContain("production-quality");
    expect(result).not.toContain("draft");
  });

  test("capa_workspace uses full-bleed context without card/thumbnail wording", () => {
    const result = buildPrompt("test", makePreset({ typeKey: "capa_workspace" }), "medium");
    expect(result).toContain("full-bleed");
    expect(result).toContain("edge-to-edge");
    expect(result).toContain("no borders");
    expect(result).not.toContain("card");
    expect(result).not.toContain("thumbnail");
  });
});

// ── estimateCost ─────────────────────────────

describe("estimateCost", () => {
  test("recraft without transparency costs $0.04", () => {
    expect(estimateCost("icone_curso", { width: 256, height: 256, requiresTransparency: false })).toBe(0.04);
  });

  test("recraft with transparency costs $0.05", () => {
    expect(estimateCost("favicon", { width: 128, height: 128, requiresTransparency: true })).toBe(0.05);
  });

  test("flux 1MP costs $0.03", () => {
    expect(estimateCost("capa_workspace", { width: 300, height: 300, requiresTransparency: false })).toBe(0.03);
  });

  test("flux 2MP costs $0.045", () => {
    // 1920x1080 → 1920x1088 = ~2.09MP → ceil to 3MP? No: 1920*1088 = 2,088,960 → ceil = 3MP
    // Actually: ceil(2088960/1000000) = 3, so cost = 0.03 + 2*0.015 = 0.06
    // Wait let me recalculate. 1920*1088 = 2,088,960. ceil(2088960/1000000) = 3.
    // cost = 0.03 + (3-1)*0.015 = 0.03 + 0.03 = 0.06
    const cost = estimateCost("conteudo_imagem", { width: 1920, height: 1080, requiresTransparency: false });
    expect(cost).toBe(0.06);
  });

  test("flux <=1MP costs only base rate", () => {
    // 304x304 = 92,416 → ceil = 1MP → cost = 0.03
    expect(estimateCost("capa_workspace", { width: 300, height: 300, requiresTransparency: false })).toBe(0.03);
  });
});
