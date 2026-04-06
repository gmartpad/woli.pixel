import { Hono } from "hono";
import { db } from "../db";
import { generationJobs, imageTypes, customPresets } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  resolveModel,
  resolveRecraftStyle,
  resolveGenerationSize,
  buildPrompt,
  estimateCost,
  resolveModelForCustom,
  resolveGenerationSizeCustom,
  estimateCostCustom,
  type QualityTier,
  type CustomStyle,
} from "../services/image-generation";
import { generateWithRecraft } from "../services/providers/recraft";
import { generateWithFlux, ModerationError } from "../services/providers/flux";
import { analyzeModeration, translatePromptToEnglish } from "../services/ai";
import { postProcessGenerated, type ImageTypeSpec } from "../services/image-processor";
import { storeGenerated, getImageBuffer, getDownloadUrl } from "../services/storage";
import sharp from "sharp";

const generateRouter = new Hono();

// POST / — Generate an image for a preset or custom dimensions
generateRouter.post("/", async (c) => {
  let body: {
    image_type_id?: string;
    custom_width?: number;
    custom_height?: number;
    custom_preset_id?: string;
    custom_style?: string;
    prompt?: string;
    quality_tier?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Body JSON inválido" }, 400);
  }

  const {
    image_type_id,
    custom_width,
    custom_height,
    custom_preset_id,
    custom_style = "auto",
    prompt,
    quality_tier = "medium",
  } = body;

  // ── Common validations ──────────────────────
  if (!prompt || prompt.trim().length < 10) {
    return c.json({ error: "prompt é obrigatório (mínimo 10 caracteres)" }, 400);
  }
  if (!["low", "medium", "high"].includes(quality_tier)) {
    return c.json({ error: "quality_tier deve ser low, medium ou high" }, 400);
  }

  // ── Mutually-exclusive source validation ────
  const hasPreset = !!image_type_id;
  const hasCustomDims = custom_width != null && custom_height != null;
  const hasCustomPreset = !!custom_preset_id;
  const sourceCount = [hasPreset, hasCustomDims, hasCustomPreset].filter(Boolean).length;

  if (sourceCount === 0) {
    return c.json({ error: "Informe exatamente um: image_type_id, custom_width+custom_height, ou custom_preset_id" }, 400);
  }
  if (sourceCount > 1) {
    return c.json({ error: "Informe exatamente um: image_type_id, custom_width+custom_height, ou custom_preset_id" }, 400);
  }

  const tier = quality_tier as QualityTier;

  // ── Translate prompt to English for better model performance ──
  const translatedPrompt = await translatePromptToEnglish(prompt.trim());

  // ── Resolve generation parameters based on source ──

  let model: "recraft_v3" | "flux2_pro";
  let genSize: { w: number; h: number };
  let enhancedPrompt: string;
  let targetSpec: ImageTypeSpec;
  let cost: number;
  let imageTypeId: string | null = null;
  let recraftStyleOverride: { style: string; substyle?: string } | null = null;
  let needsTransparency = false;

  if (hasPreset) {
    // ── Path 1: System preset (existing behavior) ──
    const [imageType] = await db.select().from(imageTypes).where(eq(imageTypes.id, image_type_id!));
    if (!imageType) {
      return c.json({ error: "Tipo de imagem não encontrado" }, 404);
    }

    imageTypeId = image_type_id!;
    model = resolveModel(imageType.typeKey);
    genSize = resolveGenerationSize(
      { width: imageType.width, height: imageType.height },
      model,
    );
    enhancedPrompt = buildPrompt(translatedPrompt, imageType as any, tier);
    cost = estimateCost(imageType.typeKey, {
      width: imageType.width,
      height: imageType.height,
      requiresTransparency: imageType.requiresTransparency,
    });
    needsTransparency = imageType.requiresTransparency === true;
    recraftStyleOverride = model === "recraft_v3" ? resolveRecraftStyle(imageType.typeKey) : null;

    targetSpec = {
      id: imageType.id,
      typeKey: imageType.typeKey,
      displayName: imageType.displayName,
      width: imageType.width,
      height: imageType.height,
      aspectRatio: imageType.aspectRatio,
      maxFileSizeKb: imageType.maxFileSizeKb,
      allowedFormats: imageType.allowedFormats,
      recommendedFormat: imageType.recommendedFormat,
      requiresTransparency: imageType.requiresTransparency,
      minWidth: imageType.minWidth,
    };
  } else if (hasCustomDims) {
    // ── Path 2: Free-form custom dimensions ──
    const w = custom_width!;
    const h = custom_height!;

    if (w < 16 || w > 4096 || h < 16 || h > 4096) {
      return c.json({ error: "Dimensões devem estar entre 16 e 4096 pixels" }, 400);
    }
    if (w * h > 4_200_000) {
      return c.json({ error: "Resolução máxima é 4.2 megapixels" }, 400);
    }

    const style = custom_style as CustomStyle;
    if (!["auto", "illustration", "photorealistic", "logo"].includes(style)) {
      return c.json({ error: "custom_style deve ser auto, illustration, photorealistic ou logo" }, 400);
    }

    model = resolveModelForCustom(style, w, h);
    genSize = resolveGenerationSizeCustom(w, h, model);
    cost = estimateCostCustom(w, h, style, false);
    needsTransparency = false;
    enhancedPrompt = translatedPrompt;

    if (model === "recraft_v3") {
      const styleMap: Record<string, string> = {
        logo: "logo_raster",
        illustration: "digital_illustration",
        auto: "digital_illustration",
        photorealistic: "realistic_image",
      };
      recraftStyleOverride = { style: styleMap[style] ?? "digital_illustration" };
    }

    targetSpec = {
      id: "custom",
      typeKey: "custom",
      displayName: `Custom ${w}x${h}`,
      width: w,
      height: h,
      aspectRatio: null,
      maxFileSizeKb: 2000,
      allowedFormats: ["png", "jpeg", "webp"],
      recommendedFormat: "png",
      requiresTransparency: false,
      minWidth: null,
    };
  } else {
    // ── Path 3: Saved custom preset ──
    const user = c.get("user" as never) as { id: string } | undefined;
    if (!user) {
      return c.json({ error: "Autenticação necessária para usar presets personalizados" }, 401);
    }

    const [preset] = await db
      .select()
      .from(customPresets)
      .where(and(eq(customPresets.id, custom_preset_id!), eq(customPresets.userId, user.id)));

    if (!preset) {
      return c.json({ error: "Preset personalizado não encontrado" }, 404);
    }

    const style = preset.style as CustomStyle;
    model = resolveModelForCustom(style, preset.width, preset.height);
    genSize = resolveGenerationSizeCustom(preset.width, preset.height, model);
    cost = estimateCostCustom(preset.width, preset.height, style, preset.requiresTransparency);
    needsTransparency = preset.requiresTransparency;

    // Prepend preset's prompt context if available
    enhancedPrompt = preset.promptContext
      ? `${preset.promptContext} ${translatedPrompt}`
      : translatedPrompt;

    if (model === "recraft_v3") {
      const styleMap: Record<string, string> = {
        logo: "logo_raster",
        illustration: "digital_illustration",
        auto: "digital_illustration",
        photorealistic: "realistic_image",
      };
      recraftStyleOverride = { style: styleMap[style] ?? "digital_illustration" };
    }

    targetSpec = {
      id: preset.id,
      typeKey: `custom_preset_${preset.name.toLowerCase().replace(/\s+/g, "_")}`,
      displayName: preset.name,
      width: preset.width,
      height: preset.height,
      aspectRatio: null,
      maxFileSizeKb: preset.maxFileSizeKb,
      allowedFormats: [preset.outputFormat],
      recommendedFormat: preset.outputFormat,
      requiresTransparency: preset.requiresTransparency,
      minWidth: null,
    };
  }

  // ── Create job record ──────────────────────
  const [job] = await db.insert(generationJobs).values({
    imageTypeId,
    model,
    prompt: prompt.trim(),
    enhancedPrompt,
    qualityTier: tier,
    style: recraftStyleOverride?.style ?? null,
    generationSizeW: genSize.w,
    generationSizeH: genSize.h,
    targetSizeW: targetSpec.width,
    targetSizeH: targetSpec.height,
    status: "pending",
  }).returning();

  try {
    // Update to generating
    await db.update(generationJobs).set({
      status: "generating",
      updatedAt: new Date(),
    }).where(eq(generationJobs.id, job.id));

    // Call provider
    let imageBuffer: Buffer;
    let providerRequestId: string | undefined;

    if (model === "recraft_v3") {
      const result = await generateWithRecraft({
        prompt: enhancedPrompt,
        style: recraftStyleOverride?.style ?? "digital_illustration",
        substyle: recraftStyleOverride?.substyle,
        size: `${genSize.w}x${genSize.h}`,
        qualityTier: tier,
        needsTransparency,
      });
      imageBuffer = result.imageBuffer;
      cost = result.cost;
    } else {
      const result = await generateWithFlux({
        prompt: enhancedPrompt,
        width: genSize.w,
        height: genSize.h,
        qualityTier: tier,
      });
      imageBuffer = result.imageBuffer;
      cost = result.cost;
    }

    // Update to processing
    await db.update(generationJobs).set({
      status: "processing",
      updatedAt: new Date(),
    }).where(eq(generationJobs.id, job.id));

    // Post-process with Sharp
    const processResult = await postProcessGenerated(imageBuffer, targetSpec);

    // Store processed image in S3
    const processedS3Key = await storeGenerated(job.id, processResult.processedBuffer, processResult.processedFormat);

    // Update to completed
    await db.update(generationJobs).set({
      status: "completed",
      processedS3Key,
      processedFormat: processResult.processedFormat,
      processedSizeKb: processResult.processedSizeKb,
      costUsd: String(cost),
      providerRequestId,
      updatedAt: new Date(),
    }).where(eq(generationJobs.id, job.id));

    return c.json({
      id: job.id,
      status: "completed",
      model,
      prompt: prompt.trim(),
      enhanced_prompt: enhancedPrompt,
      quality_tier: tier,
      cost_usd: cost,
      image: {
        width: processResult.processedWidth,
        height: processResult.processedHeight,
        format: processResult.processedFormat,
        size_kb: processResult.processedSizeKb,
        download_url: `/api/v1/generate/${job.id}/download`,
      },
    }, 201);
  } catch (err) {
    if (err instanceof ModerationError) {
      // Analyze why the prompt was moderated
      let moderation: { analysis: string; suggestedPrompt: string } = {
        analysis: "O prompt foi rejeitado pela política de conteúdo do provedor de imagens.",
        suggestedPrompt: "",
      };
      try {
        moderation = await analyzeModeration(enhancedPrompt);
      } catch {
        // If AI analysis fails, use the fallback above
      }

      await db.update(generationJobs).set({
        status: "moderated",
        errorMessage: err.message,
        updatedAt: new Date(),
      }).where(eq(generationJobs.id, job.id));

      return c.json({
        error: "Prompt rejeitado pela política de conteúdo",
        moderation: {
          flagged_reasons: err.reasons,
          analysis: moderation.analysis,
          suggested_prompt: moderation.suggestedPrompt,
        },
      }, 422);
    }

    console.error("Generation error:", err);
    await db.update(generationJobs).set({
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Erro desconhecido na geração",
      updatedAt: new Date(),
    }).where(eq(generationJobs.id, job.id));

    return c.json({
      error: "Erro na geração da imagem",
      details: err instanceof Error ? err.message : undefined,
    }, 500);
  }
});

// GET /:id — Get generation job details
generateRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, id));

  if (!job) {
    return c.json({ error: "Job de geração não encontrado" }, 404);
  }

  return c.json(job);
});

// GET /:id/download — Download generated image (with optional format conversion)
generateRouter.get("/:id/download", async (c) => {
  const id = c.req.param("id");
  const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, id));

  if (!job || !job.processedS3Key) {
    return c.json({ error: "Imagem gerada não encontrada" }, 404);
  }

  const storedFormat = job.processedFormat || "png";
  const requestedFormat = c.req.query("format");

  const VALID_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);
  if (requestedFormat && !VALID_FORMATS.has(requestedFormat.toLowerCase())) {
    return c.json({ error: "Formato inválido. Use: jpeg, jpg, png ou webp" }, 400);
  }

  // Normalize "jpg" → "jpeg" for comparison
  const normalizedRequested = requestedFormat === "jpg" ? "jpeg" : requestedFormat;

  // No format conversion: redirect to presigned S3 URL
  if (!normalizedRequested || normalizedRequested === storedFormat) {
    const ext = storedFormat === "jpeg" ? "jpg" : storedFormat;
    const downloadName = `generated-${job.id.slice(0, 8)}.${ext}`;
    const url = await getDownloadUrl(job.processedS3Key, downloadName);
    return c.redirect(url);
  }

  // Format conversion requested: download from S3, convert, stream response
  const buffer = await getImageBuffer(job.processedS3Key);
  const converted = sharp(Buffer.from(buffer));
  if (normalizedRequested === "png") converted.png();
  else if (normalizedRequested === "jpeg") converted.jpeg({ quality: 85, mozjpeg: true });
  else if (normalizedRequested === "webp") converted.webp({ quality: 85 });
  const finalBuffer = await converted.toBuffer();

  const mimeMap: Record<string, string> = {
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };

  const contentType = mimeMap[normalizedRequested] || "application/octet-stream";
  const ext = normalizedRequested === "jpeg" ? "jpg" : normalizedRequested;

  return new Response(new Uint8Array(finalBuffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="generated-${job.id.slice(0, 8)}.${ext}"`,
    },
  });
});

// GET /history — List generation history
generateRouter.get("/history", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const perPage = parseInt(c.req.query("per_page") || "20");
  const offset = (page - 1) * perPage;

  const jobs = await db
    .select()
    .from(generationJobs)
    .orderBy(desc(generationJobs.createdAt))
    .limit(perPage)
    .offset(offset);

  return c.json({ jobs, page, perPage });
});

// GET /cost/custom — Estimate cost for custom resolution
generateRouter.get("/cost/custom", async (c) => {
  const width = parseInt(c.req.query("width") || "0");
  const height = parseInt(c.req.query("height") || "0");
  const style = (c.req.query("style") || "auto") as CustomStyle;
  const requiresTransparency = c.req.query("transparency") === "true";

  if (width < 16 || height < 16 || width > 4096 || height > 4096) {
    return c.json({ error: "Dimensões devem estar entre 16 e 4096px" }, 400);
  }
  const mp = (width * height) / 1_000_000;
  if (mp > 4.2) {
    return c.json({ error: `Resolução máxima: 4.2MP (${mp.toFixed(1)}MP excede)` }, 400);
  }

  const model = resolveModelForCustom(style, width, height);
  const genSize = resolveGenerationSizeCustom(width, height, model);
  const cost = estimateCostCustom(width, height, style, requiresTransparency);

  // Per-tier costs
  const costsByTier: Record<string, number> = {};
  if (model === "flux2_pro") {
    costsByTier.low = Math.round(cost * 0.4 * 1000) / 1000;
    costsByTier.medium = Math.round(cost * 1000) / 1000;
    costsByTier.high = Math.round(cost * 1.6 * 1000) / 1000;
  } else {
    const base = requiresTransparency ? 0.05 : 0.04;
    costsByTier.low = Math.round(base * 0.5 * 1000) / 1000;
    costsByTier.medium = Math.round(base * 1000) / 1000;
    costsByTier.high = Math.round(base * 1.5 * 1000) / 1000;
  }

  return c.json({
    width,
    height,
    style,
    model,
    generationSize: `${genSize.w}x${genSize.h}`,
    targetSize: `${width}x${height}`,
    estimatedCostUsd: cost,
    costsByTier,
    note: null,
    needsTransparency: requiresTransparency,
  });
});

// GET /cost/:typeKey — Estimate cost for a preset
generateRouter.get("/cost/:typeKey", async (c) => {
  const typeKey = c.req.param("typeKey");
  const [imageType] = await db.select().from(imageTypes).where(eq(imageTypes.typeKey, typeKey));

  if (!imageType) {
    return c.json({ error: "Tipo de imagem não encontrado" }, 404);
  }

  const model = resolveModel(typeKey);
  const presetSpec = {
    width: imageType.width,
    height: imageType.height,
    requiresTransparency: imageType.requiresTransparency,
  };
  const cost = estimateCost(typeKey, presetSpec);
  const genSize = resolveGenerationSize(
    { width: imageType.width, height: imageType.height },
    model,
  );

  // Compute per-tier costs using the same model logic
  const costsByTier: Record<string, number> = {};
  for (const tier of ["low", "medium", "high"] as const) {
    costsByTier[tier] = estimateCost(typeKey, presetSpec);
  }
  // For FLUX, cost varies by megapixel not tier — but the base estimateCost doesn't take tier.
  // For Recraft, it's a flat rate. Adjust by applying tier multipliers.
  if (model === "flux2_pro") {
    const baseCost = cost;
    costsByTier.low = Math.round(baseCost * 0.4 * 1000) / 1000;
    costsByTier.medium = Math.round(baseCost * 1000) / 1000;
    costsByTier.high = Math.round(baseCost * 1.6 * 1000) / 1000;
  } else {
    // Recraft: base $0.04, tier adjustments
    costsByTier.low = 0.02;
    costsByTier.medium = 0.04;
    costsByTier.high = 0.06;
    if (imageType.requiresTransparency) {
      costsByTier.low += 0.01;
      costsByTier.medium += 0.01;
      costsByTier.high += 0.01;
    }
  }

  // Note about upscaling
  const [oaiW, oaiH] = [genSize.w, genSize.h];
  let note: string | null = null;
  if (imageType.width && imageType.height) {
    if (imageType.width > oaiW || imageType.height > oaiH) {
      const maxScale = Math.max(imageType.width / oaiW, imageType.height / oaiH);
      const pct = Math.round((maxScale - 1) * 100);
      note = `Sharp upscale ~${pct}% — qualidade "alta" recomendada`;
    }
  }

  return c.json({
    typeKey,
    displayName: imageType.displayName,
    model,
    generationSize: `${genSize.w}x${genSize.h}`,
    targetSize: imageType.width && imageType.height
      ? `${imageType.width}x${imageType.height}`
      : "variable",
    estimatedCostUsd: cost,
    costsByTier,
    note,
    needsTransparency: imageType.requiresTransparency === true,
  });
});

export { generateRouter };
