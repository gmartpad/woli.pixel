import sharp from "sharp";

/**
 * Creates a minimal test image buffer using Sharp.
 */
export async function createTestImage(
  width = 100,
  height = 100,
  format: "png" | "jpeg" | "webp" = "png",
  options?: { hasAlpha?: boolean }
): Promise<Buffer> {
  const channels = options?.hasAlpha ? 4 : 3;
  const background = options?.hasAlpha
    ? { r: 255, g: 0, b: 0, alpha: 1 }
    : { r: 255, g: 0, b: 0 };

  let pipeline = sharp({
    create: {
      width,
      height,
      channels: channels as 3 | 4,
      background,
    },
  });

  if (format === "jpeg") pipeline = pipeline.jpeg({ quality: 80 });
  else if (format === "webp") pipeline = pipeline.webp({ quality: 80 });
  else pipeline = pipeline.png();

  return pipeline.toBuffer();
}

/**
 * Creates a PNG with transparent edges (for transparency tests).
 */
export async function createTransparentTestImage(
  width = 100,
  height = 100
): Promise<Buffer> {
  // Create fully transparent base
  const transparent = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png().toBuffer();

  // Composite a smaller opaque rectangle in the center
  const innerW = Math.floor(width * 0.6);
  const innerH = Math.floor(height * 0.6);
  const inner = await sharp({
    create: {
      width: innerW,
      height: innerH,
      channels: 4,
      background: { r: 255, g: 100, b: 50, alpha: 1 },
    },
  }).png().toBuffer();

  return sharp(transparent)
    .composite([{
      input: inner,
      left: Math.floor((width - innerW) / 2),
      top: Math.floor((height - innerH) / 2),
    }])
    .png()
    .toBuffer();
}

/**
 * Subset of seed image types for test context.
 */
export const MOCK_IMAGE_TYPES = [
  {
    typeKey: "favicon",
    displayName: "Favicon",
    width: 128,
    height: 128,
    aspectRatio: "1:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png"],
    category: "admin",
  },
  {
    typeKey: "conteudo_imagem",
    displayName: "Imagem de Conteúdo",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    maxFileSizeKb: 10240,
    allowedFormats: ["png", "jpeg", "gif"],
    category: "content",
  },
  {
    typeKey: "logo_topo",
    displayName: "Logo Topo (Header)",
    width: null,
    height: null,
    aspectRatio: "variable",
    maxFileSizeKb: 500,
    allowedFormats: ["png", "jpeg"],
    category: "admin",
  },
  {
    typeKey: "fundo_login_mobile",
    displayName: "Fundo Login Mobile",
    width: 375,
    height: 820,
    aspectRatio: "~9:20",
    maxFileSizeKb: 500,
    allowedFormats: ["png", "jpeg"],
    category: "admin",
  },
];

/**
 * Valid mock analysis result from AI.
 */
export function createMockAnalysisResult() {
  return {
    quality: {
      score: 8,
      issues: [],
      blur_detected: false,
      low_resolution: false,
      poor_contrast: false,
    },
    content: {
      type: "photo" as const,
      primary_subject: "Paisagem natural",
      has_text: false,
      has_transparency: false,
      dominant_colors: ["#2563eb", "#16a34a", "#f5f5f5"],
    },
    classification: {
      suggestedType: "conteudo_imagem",
      confidence: 85,
      reasoning: "Imagem fotográfica com dimensões grandes, adequada para conteúdo educacional.",
    },
    suggestedTypeKey: "conteudo_imagem",
    cropSuggestion: {
      subject_center_x: 0.5,
      subject_center_y: 0.5,
      recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 },
    },
  };
}

/**
 * Mock OpenAI client that returns configurable responses.
 */
export function createMockOpenAI(overrides?: {
  analysisOutput?: Record<string, unknown>;
  classificationOutput?: Record<string, unknown>;
  explanationOutput?: string;
}) {
  const analysis = overrides?.analysisOutput ?? {
    quality: {
      score: 8,
      issues: [],
      blur_detected: false,
      low_resolution: false,
      poor_contrast: false,
    },
    content: {
      type: "photo",
      primary_subject: "Paisagem",
      has_text: false,
      has_transparency: false,
      dominant_colors: ["#2563eb", "#16a34a", "#f5f5f5"],
    },
    crop_suggestion: {
      subject_center_x: 0.5,
      subject_center_y: 0.5,
      recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 },
    },
  };

  const classification = overrides?.classificationOutput ?? {
    suggested_type_key: "conteudo_imagem",
    confidence: 85,
    reasoning: "Imagem fotográfica adequada para conteúdo.",
  };

  const explanation = overrides?.explanationOutput ?? "A imagem foi redimensionada e comprimida para o formato alvo.";

  return {
    responses: {
      create: (opts: Record<string, unknown>) => {
        const model = opts.model as string;
        if (model?.includes("nano")) {
          return Promise.resolve({ output_text: JSON.stringify(classification) });
        }
        // Check if it's explanation (no json schema in text)
        const text = opts.text as Record<string, unknown> | undefined;
        if (!text?.format) {
          return Promise.resolve({ output_text: explanation });
        }
        return Promise.resolve({ output_text: JSON.stringify(analysis) });
      },
    },
  };
}
