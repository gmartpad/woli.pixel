/**
 * Cost estimation for gpt-image-1-mini generation across Woli Pixel presets.
 *
 * Pricing source: OpenAI gpt-image-1-mini (April 2026)
 * Output-only costs — inpainting adds ~$0.001–0.003 per input image.
 * Batch API halves all prices for non-interactive jobs.
 */

// ── Types ────────────────────────────────────

export type QualityTier = "low" | "medium" | "high";

export type OpenAIOutputSize = "1024x1024" | "1536x1024" | "1024x1536";

export type PresetCostInfo = {
  typeKey: string;
  displayName: string;
  targetWidth: number | null;
  targetHeight: number | null;
  openaiSize: OpenAIOutputSize;
  costs: Record<QualityTier, number>;
  notes: string | null;
};

export type CostSummary = {
  presets: PresetCostInfo[];
  totals: Record<QualityTier, number>;
  squareCount: number;
  nonSquareCount: number;
};

// ── Pricing Table ────────────────────────────

const PRICING: Record<OpenAIOutputSize, Record<QualityTier, number>> = {
  "1024x1024": { low: 0.005, medium: 0.011, high: 0.036 },
  "1536x1024": { low: 0.006, medium: 0.015, high: 0.052 },
  "1024x1536": { low: 0.006, medium: 0.015, high: 0.052 },
};

// ── Quality Tier Labels (PT-BR) ──────────────

export const QUALITY_LABELS: Record<QualityTier, { label: string; description: string }> = {
  low: { label: "Rascunho", description: "Pré-visualização rápida, prototipagem, placeholders" },
  medium: { label: "Padrão", description: "Uso geral, bom equilíbrio qualidade/custo" },
  high: { label: "Alta Qualidade", description: "Ativos finais, imagens de produção" },
};

// ── Size Resolution ──────────────────────────

/**
 * Determines the closest OpenAI output size for a given preset.
 *
 * Logic:
 * - If width/height are null or equal (square-ish) → 1024x1024
 * - If width > height (landscape) → 1536x1024
 * - If height > width (portrait) → 1024x1536
 * - For tiny presets (both dims ≤ 1024), default to 1024x1024 (square)
 *   since there's no smaller option — Sharp handles the downscale.
 */
export function resolveOpenAISize(
  width: number | null,
  height: number | null,
): OpenAIOutputSize {
  if (width == null || height == null) return "1024x1024";

  // Both fit within 1024x1024 — no need for larger canvas
  if (width <= 1024 && height <= 1024) return "1024x1024";

  // Landscape
  if (width > height) return "1536x1024";

  // Portrait
  if (height > width) return "1024x1536";

  // Exactly equal but > 1024 — landscape is the closest fit
  return "1536x1024";
}

/**
 * Returns a note about potential quality implications for this preset.
 */
function getPresetNote(
  width: number | null,
  height: number | null,
  openaiSize: OpenAIOutputSize,
): string | null {
  if (width == null || height == null) return null;

  // Upscaling case: target > OpenAI output
  const [oaiW, oaiH] = openaiSize.split("x").map(Number);
  if (width > oaiW || height > oaiH) {
    const scaleX = width / oaiW;
    const scaleY = height / oaiH;
    const maxScale = Math.max(scaleX, scaleY);
    const pct = Math.round((maxScale - 1) * 100);
    return `Sharp upscale ~${pct}% — qualidade "alta" recomendada`;
  }

  // Heavy downscaling case: tiny targets
  if (width <= 96 && height <= 96) {
    return "Geração em 1024x1024, Sharp reduz — sem perda de qualidade";
  }

  return null;
}

// ── Cost Calculation ─────────────────────────

export function getCostForSize(
  size: OpenAIOutputSize,
  quality: QualityTier,
): number {
  return PRICING[size][quality];
}

export function getCostsForSize(
  size: OpenAIOutputSize,
): Record<QualityTier, number> {
  return { ...PRICING[size] };
}

/**
 * Builds a PresetCostInfo for a single image type.
 */
export function buildPresetCost(preset: {
  typeKey: string;
  displayName: string;
  width: number | null;
  height: number | null;
}): PresetCostInfo {
  const openaiSize = resolveOpenAISize(preset.width, preset.height);
  return {
    typeKey: preset.typeKey,
    displayName: preset.displayName,
    targetWidth: preset.width,
    targetHeight: preset.height,
    openaiSize,
    costs: getCostsForSize(openaiSize),
    notes: getPresetNote(preset.width, preset.height, openaiSize),
  };
}

/**
 * Builds the full cost summary for a list of image type presets.
 */
export function buildCostSummary(presets: Array<{
  typeKey: string;
  displayName: string;
  width: number | null;
  height: number | null;
}>): CostSummary {
  const presetCosts = presets.map(buildPresetCost);

  const totals: Record<QualityTier, number> = { low: 0, medium: 0, high: 0 };
  let squareCount = 0;
  let nonSquareCount = 0;

  for (const p of presetCosts) {
    totals.low += p.costs.low;
    totals.medium += p.costs.medium;
    totals.high += p.costs.high;

    if (p.openaiSize === "1024x1024") squareCount++;
    else nonSquareCount++;
  }

  // Round totals to avoid floating-point drift
  totals.low = Math.round(totals.low * 1000) / 1000;
  totals.medium = Math.round(totals.medium * 1000) / 1000;
  totals.high = Math.round(totals.high * 1000) / 1000;

  return { presets: presetCosts, totals, squareCount, nonSquareCount };
}
