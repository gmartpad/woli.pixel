import { describe, test, expect } from "bun:test";
import {
  resolveOpenAISize,
  getCostForSize,
  getCostsForSize,
  buildPresetCost,
  buildCostSummary,
} from "./generation-cost";

// ── resolveOpenAISize ───────────────────────────

describe("resolveOpenAISize", () => {
  describe("null dimensions default to 1024x1024", () => {
    test("(null, null) -> 1024x1024", () => {
      expect(resolveOpenAISize(null, null)).toBe("1024x1024");
    });

    test("(null, 256) -> 1024x1024", () => {
      expect(resolveOpenAISize(null, 256)).toBe("1024x1024");
    });

    test("(256, null) -> 1024x1024", () => {
      expect(resolveOpenAISize(256, null)).toBe("1024x1024");
    });
  });

  describe("both dims <= 1024 -> 1024x1024 (square)", () => {
    test("(128, 128) -> 1024x1024", () => {
      expect(resolveOpenAISize(128, 128)).toBe("1024x1024");
    });

    test("(256, 256) -> 1024x1024", () => {
      expect(resolveOpenAISize(256, 256)).toBe("1024x1024");
    });

    test("(1024, 1024) -> 1024x1024", () => {
      expect(resolveOpenAISize(1024, 1024)).toBe("1024x1024");
    });

    test("(27, 27) -> 1024x1024 (tiny square)", () => {
      expect(resolveOpenAISize(27, 27)).toBe("1024x1024");
    });

    test("(72, 72) -> 1024x1024 (small square)", () => {
      expect(resolveOpenAISize(72, 72)).toBe("1024x1024");
    });

    test("(600, 100) -> 1024x1024 (wide but both <= 1024)", () => {
      expect(resolveOpenAISize(600, 100)).toBe("1024x1024");
    });

    test("(650, 200) -> 1024x1024 (wide but both <= 1024)", () => {
      expect(resolveOpenAISize(650, 200)).toBe("1024x1024");
    });

    test("(375, 820) -> 1024x1024 (portrait but both <= 1024)", () => {
      expect(resolveOpenAISize(375, 820)).toBe("1024x1024");
    });

    test("(1200, 300) -> 1024x1024 is wrong — 1200 > 1024, landscape", () => {
      // 1200 > 1024, so it exceeds the square range. w > h -> landscape
      expect(resolveOpenAISize(1200, 300)).toBe("1536x1024");
    });
  });

  describe("landscape (w > h, at least one dim > 1024)", () => {
    test("(1920, 1080) -> 1536x1024", () => {
      expect(resolveOpenAISize(1920, 1080)).toBe("1536x1024");
    });

    test("(1600, 900) -> 1536x1024", () => {
      expect(resolveOpenAISize(1600, 900)).toBe("1536x1024");
    });
  });

  describe("portrait (h > w, at least one dim > 1024)", () => {
    test("(720, 1280) -> 1024x1536", () => {
      expect(resolveOpenAISize(720, 1280)).toBe("1024x1536");
    });

    test("(900, 1600) -> 1024x1536", () => {
      expect(resolveOpenAISize(900, 1600)).toBe("1024x1536");
    });
  });

  describe("equal dims > 1024 -> 1536x1024 (landscape fallback)", () => {
    test("(2048, 2048) -> 1536x1024", () => {
      expect(resolveOpenAISize(2048, 2048)).toBe("1536x1024");
    });
  });
});

// ── getCostForSize ──────────────────────────────

describe("getCostForSize", () => {
  describe("square (1024x1024)", () => {
    test("low = 0.005", () => {
      expect(getCostForSize("1024x1024", "low")).toBe(0.005);
    });

    test("medium = 0.011", () => {
      expect(getCostForSize("1024x1024", "medium")).toBe(0.011);
    });

    test("high = 0.036", () => {
      expect(getCostForSize("1024x1024", "high")).toBe(0.036);
    });
  });

  describe("landscape (1536x1024)", () => {
    test("low = 0.006", () => {
      expect(getCostForSize("1536x1024", "low")).toBe(0.006);
    });

    test("medium = 0.015", () => {
      expect(getCostForSize("1536x1024", "medium")).toBe(0.015);
    });

    test("high = 0.052", () => {
      expect(getCostForSize("1536x1024", "high")).toBe(0.052);
    });
  });

  describe("portrait (1024x1536) matches landscape pricing", () => {
    test("low = 0.006", () => {
      expect(getCostForSize("1024x1536", "low")).toBe(0.006);
    });

    test("medium = 0.015", () => {
      expect(getCostForSize("1024x1536", "medium")).toBe(0.015);
    });

    test("high = 0.052", () => {
      expect(getCostForSize("1024x1536", "high")).toBe(0.052);
    });
  });
});

// ── getCostsForSize ─────────────────────────────

describe("getCostsForSize", () => {
  test("returns all 3 tiers for square", () => {
    const costs = getCostsForSize("1024x1024");
    expect(costs).toEqual({ low: 0.005, medium: 0.011, high: 0.036 });
  });

  test("returns all 3 tiers for landscape", () => {
    const costs = getCostsForSize("1536x1024");
    expect(costs).toEqual({ low: 0.006, medium: 0.015, high: 0.052 });
  });

  test("returns all 3 tiers for portrait", () => {
    const costs = getCostsForSize("1024x1536");
    expect(costs).toEqual({ low: 0.006, medium: 0.015, high: 0.052 });
  });

  test("returns a copy (not a reference)", () => {
    const a = getCostsForSize("1024x1024");
    const b = getCostsForSize("1024x1024");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

// ── buildPresetCost ─────────────────────────────

describe("buildPresetCost", () => {
  test("favicon (128, 128) -> square costs, no notes", () => {
    const result = buildPresetCost({
      typeKey: "favicon",
      displayName: "Favicon",
      width: 128,
      height: 128,
    });

    expect(result.typeKey).toBe("favicon");
    expect(result.displayName).toBe("Favicon");
    expect(result.targetWidth).toBe(128);
    expect(result.targetHeight).toBe(128);
    expect(result.openaiSize).toBe("1024x1024");
    expect(result.costs).toEqual({ low: 0.005, medium: 0.011, high: 0.036 });
    // 128x128 is not <= 96 and not > OpenAI output, so no note
    expect(result.notes).toBeNull();
  });

  test("conteudo_imagem (1920, 1080) -> landscape costs, upscale note", () => {
    const result = buildPresetCost({
      typeKey: "conteudo_imagem",
      displayName: "Imagem de Conteúdo",
      width: 1920,
      height: 1080,
    });

    expect(result.openaiSize).toBe("1536x1024");
    expect(result.costs).toEqual({ low: 0.006, medium: 0.015, high: 0.052 });
    // 1920 > 1536, so upscale note is generated
    expect(result.notes).not.toBeNull();
    expect(result.notes).toContain("Sharp upscale");
    expect(result.notes).toContain("qualidade");
  });

  test("variable (null, null) -> square costs, null notes", () => {
    const result = buildPresetCost({
      typeKey: "logo_topo",
      displayName: "Logo Topo (Header)",
      width: null,
      height: null,
    });

    expect(result.targetWidth).toBeNull();
    expect(result.targetHeight).toBeNull();
    expect(result.openaiSize).toBe("1024x1024");
    expect(result.costs).toEqual({ low: 0.005, medium: 0.011, high: 0.036 });
    expect(result.notes).toBeNull();
  });

  test("preserves typeKey and displayName", () => {
    const result = buildPresetCost({
      typeKey: "custom_key",
      displayName: "Custom Name",
      width: 500,
      height: 500,
    });

    expect(result.typeKey).toBe("custom_key");
    expect(result.displayName).toBe("Custom Name");
  });

  test("tiny preset (27, 27) has downscale note", () => {
    const result = buildPresetCost({
      typeKey: "logo_dispersao",
      displayName: "Logo Mapa Dispersão",
      width: 27,
      height: 27,
    });

    expect(result.openaiSize).toBe("1024x1024");
    expect(result.notes).not.toBeNull();
    expect(result.notes).toContain("1024x1024");
    expect(result.notes).toContain("Sharp reduz");
  });

  test("small icon preset (72, 72) has downscale note", () => {
    const result = buildPresetCost({
      typeKey: "icone_pilula",
      displayName: "Ícone Notificação Pílula",
      width: 72,
      height: 72,
    });

    expect(result.openaiSize).toBe("1024x1024");
    expect(result.notes).not.toBeNull();
    expect(result.notes).toContain("Sharp reduz");
  });
});

// ── buildCostSummary ────────────────────────────

describe("buildCostSummary", () => {
  // Full seed data for integration testing
  const FULL_SEED = [
    { typeKey: "logo_topo", displayName: "Logo Topo (Header)", width: null, height: null },
    { typeKey: "logo_relatorios", displayName: "Logo Relatórios", width: 650, height: 200 },
    { typeKey: "fundo_login", displayName: "Fundo Login Desktop", width: 1600, height: 900 },
    { typeKey: "fundo_login_mobile", displayName: "Fundo Login Mobile", width: 375, height: 820 },
    { typeKey: "icone_pilula", displayName: "Ícone Notificação Pílula", width: 72, height: 72 },
    { typeKey: "favicon", displayName: "Favicon", width: 128, height: 128 },
    { typeKey: "testeira_email", displayName: "Testeira E-mail", width: 600, height: 100 },
    { typeKey: "logo_app", displayName: "Logo Interno App", width: null, height: null },
    { typeKey: "logo_dispersao", displayName: "Logo Mapa Dispersão", width: 27, height: 27 },
    { typeKey: "conteudo_imagem", displayName: "Imagem de Conteúdo", width: 1920, height: 1080 },
    { typeKey: "capa_workspace", displayName: "Capa Workspace", width: 300, height: 300 },
    { typeKey: "fundo_workspace", displayName: "Fundo Workspace", width: 1920, height: 1080 },
    { typeKey: "icone_curso", displayName: "Ícone de Curso", width: 256, height: 256 },
    { typeKey: "foto_aluno", displayName: "Foto de Perfil", width: 256, height: 256 },
    { typeKey: "badge_conquista", displayName: "Badge de Conquista", width: 128, height: 128 },
    { typeKey: "medalha_ranking", displayName: "Medalha de Ranking", width: 96, height: 96 },
    { typeKey: "icone_recompensa", displayName: "Ícone de Recompensa", width: 200, height: 200 },
    { typeKey: "banner_campanha", displayName: "Banner de Campanha", width: 1200, height: 300 },
    { typeKey: "avatar_personagem", displayName: "Avatar de Personagem", width: 256, height: 256 },
  ];

  test("produces 19 presets from full seed data", () => {
    const summary = buildCostSummary(FULL_SEED);
    expect(summary.presets).toHaveLength(19);
  });

  test("squareCount = 15, nonSquareCount = 4", () => {
    const summary = buildCostSummary(FULL_SEED);
    // Square (1024x1024): logo_topo, logo_relatorios, fundo_login_mobile, icone_pilula,
    //   favicon, testeira_email, logo_app, logo_dispersao, capa_workspace, icone_curso,
    //   foto_aluno, badge_conquista, medalha_ranking, icone_recompensa, avatar_personagem = 15
    // Non-square: fundo_login, conteudo_imagem, fundo_workspace, banner_campanha = 4
    expect(summary.squareCount).toBe(15);
    expect(summary.nonSquareCount).toBe(4);
  });

  test("totals match expected values (15 square + 4 non-square)", () => {
    const summary = buildCostSummary(FULL_SEED);
    // low:    15 * 0.005 + 4 * 0.006 = 0.075 + 0.024 = 0.099
    // medium: 15 * 0.011 + 4 * 0.015 = 0.165 + 0.060 = 0.225
    // high:   15 * 0.036 + 4 * 0.052 = 0.540 + 0.208 = 0.748
    expect(summary.totals.low).toBe(0.099);
    expect(summary.totals.medium).toBe(0.225);
    expect(summary.totals.high).toBe(0.748);
  });

  test("empty input produces zero totals", () => {
    const summary = buildCostSummary([]);
    expect(summary.presets).toHaveLength(0);
    expect(summary.squareCount).toBe(0);
    expect(summary.nonSquareCount).toBe(0);
    expect(summary.totals).toEqual({ low: 0, medium: 0, high: 0 });
  });

  test("single square preset totals match its costs exactly", () => {
    const summary = buildCostSummary([
      { typeKey: "favicon", displayName: "Favicon", width: 128, height: 128 },
    ]);

    expect(summary.squareCount).toBe(1);
    expect(summary.nonSquareCount).toBe(0);
    expect(summary.totals).toEqual({ low: 0.005, medium: 0.011, high: 0.036 });
  });

  test("single landscape preset totals match its costs exactly", () => {
    const summary = buildCostSummary([
      { typeKey: "conteudo_imagem", displayName: "Imagem de Conteúdo", width: 1920, height: 1080 },
    ]);

    expect(summary.squareCount).toBe(0);
    expect(summary.nonSquareCount).toBe(1);
    expect(summary.totals).toEqual({ low: 0.006, medium: 0.015, high: 0.052 });
  });

  test("totals are rounded to 3 decimal places (no floating-point drift)", () => {
    const summary = buildCostSummary(FULL_SEED);
    // Verify that totals have at most 3 decimal digits
    for (const tier of ["low", "medium", "high"] as const) {
      const val = summary.totals[tier];
      const rounded = Math.round(val * 1000) / 1000;
      expect(val).toBe(rounded);
    }
  });
});
