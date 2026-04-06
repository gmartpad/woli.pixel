/**
 * Core image generation service — routes presets to the optimal model
 * and orchestrates the generate → remove-bg → Sharp pipeline.
 */

export type GenerationModel = "recraft_v3" | "flux2_pro";
export type QualityTier = "low" | "medium" | "high";

export type ImageTypeForGeneration = {
  typeKey: string;
  displayName: string;
  description: string | null;
  width: number | null;
  height: number | null;
  requiresTransparency: boolean | null;
  recommendedFormat: string;
  maxFileSizeKb: number;
  category: string;
};

// ── Preset-to-Model Mapping ─��────────────────

const FLUX_PRESETS = new Set([
  "fundo_login",
  "fundo_login_mobile",
  "testeira_email",
  "conteudo_imagem",
  "capa_workspace",
  "fundo_workspace",
  "banner_campanha",
]);

export function resolveModel(typeKey: string): GenerationModel {
  return FLUX_PRESETS.has(typeKey) ? "flux2_pro" : "recraft_v3";
}

// ── Recraft Style Mapping ────────────────────

const STYLE_MAP: Record<string, { style: string; substyle?: string }> = {
  logo_topo: { style: "logo_raster" },
  logo_relatorios: { style: "logo_raster" },
  logo_app: { style: "logo_raster" },
  logo_dispersao: { style: "digital_illustration" },
  favicon: { style: "digital_illustration" },
  icone_pilula: { style: "digital_illustration" },
  icone_curso: { style: "digital_illustration" },
  icone_recompensa: { style: "digital_illustration" },
  badge_conquista: { style: "digital_illustration" },
  medalha_ranking: { style: "digital_illustration" },
  avatar_personagem: { style: "digital_illustration", substyle: "handmade_3d" },
  foto_aluno: { style: "realistic_image", substyle: "studio_portrait" },
};

export function resolveRecraftStyle(typeKey: string): { style: string; substyle?: string } {
  return STYLE_MAP[typeKey] ?? { style: "digital_illustration" };
}

// ── Generation Size Resolution ───────────────

export function resolveGenerationSize(
  preset: { width: number | null; height: number | null },
  model: GenerationModel,
): { w: number; h: number } {
  if (model === "recraft_v3") {
    // Recraft minimum supported size is 1024x1024
    return { w: 1024, h: 1024 };
  }

  // FLUX: round up to nearest multiple of 16
  const w = preset.width ?? 1024;
  const h = preset.height ?? 1024;
  return {
    w: Math.ceil(w / 16) * 16,
    h: Math.ceil(h / 16) * 16,
  };
}

// ── Prompt Enhancement ───────────────────────

const PRESET_CONTEXT: Record<string, string> = {
  // Logos
  logo_topo: "Professional logo mark for a corporate education platform header. Clean edges, minimal design.",
  logo_relatorios: "Professional logo for PDF report headers. Horizontal layout, clean and legible.",
  logo_app: "Mobile app logo, clean and recognizable at small sizes.",
  logo_dispersao: "Tiny map marker icon, must be recognizable at 27x27 pixels. Extremely simple.",
  // Admin
  favicon: "Browser tab favicon, simple and iconic. Must be recognizable at 16x16.",
  icone_pilula: "Notification icon for knowledge pills. Simple, clean, recognizable at small sizes.",
  testeira_email: "Wide email header banner for a corporate education platform. Professional, no text needed.",
  // Backgrounds
  fundo_login: "Full-bleed desktop login background. Atmospheric, professional, no text or UI elements.",
  fundo_login_mobile: "Vertical mobile login background. Atmospheric, professional, no text or UI elements.",
  fundo_workspace: "Full-bleed workspace background. Subtle, professional, no text or UI elements.",
  // Content
  conteudo_imagem: "Educational content image for a corporate LMS platform. Professional and engaging.",
  capa_workspace: "Square cover image, full-bleed, edge-to-edge composition with no borders, margins, rounded corners, or padding. Eye-catching, professional.",
  // Gamification
  badge_conquista: "Achievement badge for gamification. Circular design, celebratory, detailed but clear.",
  medalha_ranking: "Ranking medal (gold/silver/bronze style). Clean, iconic, recognizable at small sizes.",
  icone_recompensa: "Reward shop item icon. Appealing, clear, works at small sizes.",
  banner_campanha: "Wide gamification campaign banner. Energetic, promotional, engaging.",
  avatar_personagem: "Character avatar/mascot for gamified interactions. Friendly, approachable, consistent style.",
  // User
  foto_aluno: "Professional profile photo placeholder. Neutral, suitable for corporate education context.",
  icone_curso: "Course thumbnail icon. Educational theme, professional, works at small sizes.",
};

export function buildPrompt(
  userPrompt: string,
  preset: ImageTypeForGeneration,
  qualityTier: QualityTier,
): string {
  const context = PRESET_CONTEXT[preset.typeKey] ?? preset.description ?? "";
  const qualityHint = qualityTier === "high"
    ? "Highly detailed, production-quality."
    : qualityTier === "low"
      ? "Simple, clean, suitable for draft/preview."
      : "";

  return [context, userPrompt, qualityHint].filter(Boolean).join(" ").trim();
}

// ── Cost Estimation ──���───────────────────────

export function estimateCost(typeKey: string, preset: { width: number | null; height: number | null; requiresTransparency: boolean | null }): number {
  const model = resolveModel(typeKey);

  if (model === "recraft_v3") {
    const base = 0.04;
    const removeBg = preset.requiresTransparency ? 0.01 : 0;
    return base + removeBg;
  }

  // FLUX: $0.03 for first MP + $0.015 per extra MP
  const size = resolveGenerationSize(preset, "flux2_pro");
  const megapixels = Math.ceil((size.w * size.h) / 1_000_000);
  return 0.03 + Math.max(0, megapixels - 1) * 0.015;
}

// ── Custom Resolution Helpers ───────────────

export type CustomStyle = "auto" | "illustration" | "photorealistic" | "logo";

/**
 * Determines the optimal AI model for custom resolution based on style.
 * "auto" uses dimension heuristics: small squares → Recraft, large/landscape → FLUX.
 */
export function resolveModelForCustom(
  style: CustomStyle,
  width?: number,
  height?: number,
): GenerationModel {
  switch (style) {
    case "photorealistic":
      return "flux2_pro";
    case "logo":
    case "illustration":
      return "recraft_v3";
    case "auto":
    default: {
      const w = width ?? 512;
      const h = height ?? 512;
      const isSmallSquare = w <= 512 && h <= 512 && Math.abs(w - h) <= 64;
      return isSmallSquare ? "recraft_v3" : "flux2_pro";
    }
  }
}

/**
 * Resolves the generation size for custom dimensions.
 */
export function resolveGenerationSizeCustom(
  targetWidth: number,
  targetHeight: number,
  model: GenerationModel,
): { w: number; h: number } {
  if (model === "recraft_v3") {
    return { w: 1024, h: 1024 };
  }
  return {
    w: Math.ceil(targetWidth / 16) * 16,
    h: Math.ceil(targetHeight / 16) * 16,
  };
}

/**
 * Estimates cost for custom resolution generation.
 */
export function estimateCostCustom(
  width: number,
  height: number,
  style: CustomStyle,
  requiresTransparency: boolean,
): number {
  const model = resolveModelForCustom(style, width, height);
  if (model === "recraft_v3") {
    return 0.04 + (requiresTransparency ? 0.01 : 0);
  }
  const genSize = resolveGenerationSizeCustom(width, height, "flux2_pro");
  const megapixels = Math.ceil((genSize.w * genSize.h) / 1_000_000);
  return 0.03 + Math.max(0, megapixels - 1) * 0.015;
}
