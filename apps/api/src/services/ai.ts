import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes("placeholder")) {
  console.warn("⚠️  OPENAI_API_KEY não configurada ou é placeholder. A análise de IA não funcionará.");
}

type ImageTypeForContext = {
  typeKey: string;
  displayName: string;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  maxFileSizeKb: number;
  allowedFormats: string[];
  category: string;
};

export type AnalysisResult = {
  quality: {
    score: number;
    issues: string[];
    blur_detected: boolean;
    low_resolution: boolean;
    poor_contrast: boolean;
  };
  content: {
    type: string;
    primary_subject: string;
    has_text: boolean;
    has_transparency: boolean;
    dominant_colors: string[];
  };
  classification: {
    suggestedType: string;
    confidence: number;
    reasoning: string;
  };
  suggestedTypeKey: string;
  cropSuggestion: {
    subject_center_x: number;
    subject_center_y: number;
    recommended_crop: { x1: number; y1: number; x2: number; y2: number };
  };
};

const IMAGE_ANALYSIS_SYSTEM_PROMPT = (typesJson: string) => `You are an image validation assistant for Woli, a corporate education platform (LMS/LXP).

Analyze this image for: content type, quality issues, subject position, and visual properties.

Quality analysis must detect: blur, sharpness, contrast, resolution suitability, compression artifacts.

Available Woli image types (from production Constantes.cs):
${typesJson}

Important:
- Types with null width/height have variable dimensions (only min_width matters)
- Two size tiers: 500KB (admin/branding) and 10MB (content)
- "icone_curso" accepts ONLY .jpg — no .png
- For variable-width types, suggest optimal dimensions based on image content

All text fields (issues, reasoning, primary_subject) must be in Brazilian Portuguese.`;

const analysisSchema = {
  type: "object" as const,
  properties: {
    quality: {
      type: "object" as const,
      properties: {
        score: { type: "number" as const, description: "Quality score 1-10" },
        issues: { type: "array" as const, items: { type: "string" as const }, description: "List of quality issues in Portuguese" },
        blur_detected: { type: "boolean" as const },
        low_resolution: { type: "boolean" as const },
        poor_contrast: { type: "boolean" as const },
      },
      required: ["score", "issues", "blur_detected", "low_resolution", "poor_contrast"],
      additionalProperties: false,
    },
    content: {
      type: "object" as const,
      properties: {
        type: { type: "string" as const, enum: ["photo", "logo", "icon", "screenshot", "illustration", "banner", "other"] },
        primary_subject: { type: "string" as const, description: "Primary subject in Portuguese" },
        has_text: { type: "boolean" as const },
        has_transparency: { type: "boolean" as const },
        dominant_colors: { type: "array" as const, items: { type: "string" as const }, description: "Top 3 hex colors" },
      },
      required: ["type", "primary_subject", "has_text", "has_transparency", "dominant_colors"],
      additionalProperties: false,
    },
    crop_suggestion: {
      type: "object" as const,
      properties: {
        subject_center_x: { type: "number" as const },
        subject_center_y: { type: "number" as const },
        recommended_crop: {
          type: "object" as const,
          properties: {
            x1: { type: "number" as const },
            y1: { type: "number" as const },
            x2: { type: "number" as const },
            y2: { type: "number" as const },
          },
          required: ["x1", "y1", "x2", "y2"],
          additionalProperties: false,
        },
      },
      required: ["subject_center_x", "subject_center_y", "recommended_crop"],
      additionalProperties: false,
    },
  },
  required: ["quality", "content", "crop_suggestion"],
  additionalProperties: false,
};

const classificationSchema = {
  type: "object" as const,
  properties: {
    suggested_type_key: { type: "string" as const, description: "The type_key of the best matching Woli image type" },
    confidence: { type: "number" as const, description: "Confidence percentage 0-100" },
    reasoning: { type: "string" as const, description: "Reasoning in Brazilian Portuguese" },
  },
  required: ["suggested_type_key", "confidence", "reasoning"],
  additionalProperties: false,
};

export async function analyzeImage(
  base64DataUrl: string,
  imageTypesContext: ImageTypeForContext[]
): Promise<AnalysisResult> {
  const typesJson = JSON.stringify(
    imageTypesContext.map(t => ({
      type_key: t.typeKey,
      display_name: t.displayName,
      width: t.width,
      height: t.height,
      aspect_ratio: t.aspectRatio,
      max_file_size_kb: t.maxFileSizeKb,
      allowed_formats: t.allowedFormats,
      category: t.category,
    })),
    null,
    2
  );

  // STEP 1: Image Analysis (gpt-4.1-mini with vision — image sent here ONLY)
  const analysisResponse = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: IMAGE_ANALYSIS_SYSTEM_PROMPT(typesJson) },
      {
        role: "user",
        content: [
          { type: "input_image", image_url: base64DataUrl, detail: "high" },
          { type: "input_text", text: "Analyze this image for the Woli platform." },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "image_analysis",
        strict: true,
        schema: analysisSchema,
      },
    },
  });

  const analysis = JSON.parse(analysisResponse.output_text);

  // STEP 2: Classification (gpt-4.1-nano — text only, no image re-sent)
  const classificationResponse = await openai.responses.create({
    model: "gpt-4.1-nano",
    input: [
      {
        role: "system",
        content: `You are a classification assistant. Given an image analysis result, determine which Woli image type is the best match. Return the type_key, confidence (0-100), and reasoning in Brazilian Portuguese.`,
      },
      {
        role: "user",
        content: `Analysis result:\n${JSON.stringify(analysis)}\n\nAvailable types:\n${typesJson}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "classification",
        strict: true,
        schema: classificationSchema,
      },
    },
  });

  const classification = JSON.parse(classificationResponse.output_text);

  return {
    quality: analysis.quality,
    content: analysis.content,
    classification: {
      suggestedType: classification.suggested_type_key,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
    },
    suggestedTypeKey: classification.suggested_type_key,
    cropSuggestion: analysis.crop_suggestion,
  };
}

export async function generateExplanation(
  original: { width: number; height: number; format: string; sizeKb: number },
  processed: { width: number; height: number; format: string; sizeKb: number },
  adjustments: string[],
  targetTypeName: string
): Promise<string> {
  const adjustmentLabels: Record<string, string> = {
    resized: "redimensionamento",
    smart_cropped: "recorte inteligente",
    format_converted: "conversão de formato",
    compressed: "compressão",
  };

  const adjustmentList = adjustments.map(a => adjustmentLabels[a] || a).join(", ");

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: "Você é um assistente que explica ajustes de imagem em português brasileiro de forma clara e concisa. Gere 2-3 frases explicando o que foi feito e por quê.",
      },
      {
        role: "user",
        content: `Imagem original: ${original.width}×${original.height}px, ${original.format.toUpperCase()}, ${original.sizeKb}KB
Imagem processada: ${processed.width}×${processed.height}px, ${processed.format.toUpperCase()}, ${processed.sizeKb}KB
Ajustes aplicados: ${adjustmentList}
Tipo alvo: ${targetTypeName}`,
      },
    ],
  });

  return response.output_text;
}

export type ModerationAnalysis = {
  analysis: string;
  suggestedPrompt: string;
};

const moderationAnalysisSchema = {
  type: "object" as const,
  properties: {
    analysis: {
      type: "string" as const,
      description: "Explicação em português brasileiro do motivo da rejeição, identificando quais partes do prompt violaram a política de conteúdo",
    },
    suggested_prompt: {
      type: "string" as const,
      description: "Prompt alternativo que mantém a intenção original mas evita as violações identificadas",
    },
  },
  required: ["analysis", "suggested_prompt"],
  additionalProperties: false,
};

export async function analyzeModeration(prompt: string): Promise<ModerationAnalysis> {
  const response = await openai.responses.create({
    model: "gpt-4.1-nano",
    input: [
      {
        role: "system",
        content: `Você é um assistente que analisa prompts de geração de imagem que foram rejeitados por políticas de conteúdo. Identifique quais partes do prompt provavelmente causaram a rejeição (personagens protegidos por direitos autorais, conteúdo violento, marcas registradas, etc.) e sugira um prompt alternativo que mantenha a mesma intenção criativa mas evite as violações. Responda em português brasileiro.`,
      },
      {
        role: "user",
        content: `O seguinte prompt de geração de imagem foi rejeitado pela política de conteúdo:\n\n"${prompt}"\n\nAnalise o motivo da rejeição e sugira uma alternativa.`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "moderation_analysis",
        strict: true,
        schema: moderationAnalysisSchema,
      },
    },
  });

  const parsed = JSON.parse(response.output_text);
  return {
    analysis: parsed.analysis,
    suggestedPrompt: parsed.suggested_prompt,
  };
}
