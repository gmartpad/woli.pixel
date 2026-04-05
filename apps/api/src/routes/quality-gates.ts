import { Hono } from "hono";
import { db } from "../db";
import { qualityGateConfigs, gateResults, imageUploads, imageTypes, brandProfiles } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { evaluateGate } from "../services/quality-gate";
import { analyzeBrandConsistency } from "../services/color-analysis";
import { analyzeImage } from "../services/ai";
import { validateFile, extractMetadata } from "../services/upload-validator";
import { verifyWebhookSignature } from "../middleware/webhook-auth";
import { randomBytes } from "crypto";
import path from "path";
import { mkdir } from "fs/promises";

const qualityGatesRouter = new Hono();
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

// ── Config CRUD ──────────────────────────────

// POST /api/v1/quality-gates — Create config
qualityGatesRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name) return c.json({ error: "name é obrigatório" }, 400);

    const webhookSecret = body.generate_secret ? randomBytes(32).toString("hex") : body.webhook_secret || null;

    const [config] = await db.insert(qualityGateConfigs).values({
      name: body.name,
      minQualityScore: body.min_quality_score ?? 6,
      maxFileSizeKb: body.max_file_size_kb || null,
      requireNoBlur: body.require_no_blur ?? true,
      requireNoLowResolution: body.require_no_low_resolution ?? true,
      requireMinWidth: body.require_min_width || null,
      requireMinHeight: body.require_min_height || null,
      allowedContentTypes: body.allowed_content_types || null,
      blockedContentTypes: body.blocked_content_types || null,
      brandProfileId: body.brand_profile_id || null,
      webhookSecret,
    }).returning();

    return c.json(config, 201);
  } catch (err) {
    console.error("Gate create error:", err);
    return c.json({ error: "Erro ao criar quality gate" }, 500);
  }
});

// GET /api/v1/quality-gates — List configs
qualityGatesRouter.get("/", async (c) => {
  const configs = await db.select().from(qualityGateConfigs).orderBy(qualityGateConfigs.name);
  return c.json(configs);
});

// GET /api/v1/quality-gates/:id — Get config
qualityGatesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [config] = await db.select().from(qualityGateConfigs).where(eq(qualityGateConfigs.id, id));
  if (!config) return c.json({ error: "Quality gate não encontrado" }, 404);
  return c.json(config);
});

// PUT /api/v1/quality-gates/:id — Update config
qualityGatesRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const [existing] = await db.select().from(qualityGateConfigs).where(eq(qualityGateConfigs.id, id));
    if (!existing) return c.json({ error: "Quality gate não encontrado" }, 404);

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.is_active !== undefined) updates.isActive = body.is_active;
    if (body.min_quality_score !== undefined) updates.minQualityScore = body.min_quality_score;
    if (body.max_file_size_kb !== undefined) updates.maxFileSizeKb = body.max_file_size_kb;
    if (body.require_no_blur !== undefined) updates.requireNoBlur = body.require_no_blur;
    if (body.require_no_low_resolution !== undefined) updates.requireNoLowResolution = body.require_no_low_resolution;
    if (body.require_min_width !== undefined) updates.requireMinWidth = body.require_min_width;
    if (body.require_min_height !== undefined) updates.requireMinHeight = body.require_min_height;
    if (body.allowed_content_types !== undefined) updates.allowedContentTypes = body.allowed_content_types;
    if (body.blocked_content_types !== undefined) updates.blockedContentTypes = body.blocked_content_types;
    if (body.brand_profile_id !== undefined) updates.brandProfileId = body.brand_profile_id;
    if (body.webhook_secret !== undefined) updates.webhookSecret = body.webhook_secret;
    if (body.generate_secret) updates.webhookSecret = randomBytes(32).toString("hex");

    const [updated] = await db.update(qualityGateConfigs).set(updates).where(eq(qualityGateConfigs.id, id)).returning();
    return c.json(updated);
  } catch (err) {
    console.error("Gate update error:", err);
    return c.json({ error: "Erro ao atualizar quality gate" }, 500);
  }
});

// DELETE /api/v1/quality-gates/:id — Delete config
qualityGatesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db.select().from(qualityGateConfigs).where(eq(qualityGateConfigs.id, id));
  if (!existing) return c.json({ error: "Quality gate não encontrado" }, 404);

  await db.delete(gateResults).where(eq(gateResults.gateConfigId, id));
  await db.delete(qualityGateConfigs).where(eq(qualityGateConfigs.id, id));
  return c.json({ deleted: true });
});

// ── Validation Endpoints ─────────────────────

async function runValidation(
  gateId: string,
  buffer: Buffer,
  filename: string,
  source: string,
  sourceReference?: string
) {
  const [config] = await db.select().from(qualityGateConfigs).where(eq(qualityGateConfigs.id, gateId));
  if (!config) throw { status: 404, message: "Quality gate não encontrado" };

  const meta = await extractMetadata(buffer);

  // Save the file
  await mkdir(UPLOAD_DIR, { recursive: true });
  const savedFilename = `gate-${Date.now()}-${filename}`;
  const filePath = path.join(UPLOAD_DIR, savedFilename);
  await Bun.write(filePath, buffer);

  // Create upload record
  const [upload] = await db.insert(imageUploads).values({
    originalFilename: filename,
    originalFormat: meta.format,
    originalWidth: meta.width,
    originalHeight: meta.height,
    originalSizeKb: meta.sizeKb,
    originalPath: filePath,
    status: "uploaded",
  }).returning();

  // Run AI analysis
  const mimeType = meta.format === "png" ? "image/png"
    : meta.format === "gif" ? "image/gif"
    : meta.format === "webp" ? "image/webp"
    : "image/jpeg";
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const types = await db.select().from(imageTypes);
  const analysis = await analyzeImage(dataUrl, types);

  // Update upload with analysis
  const suggestedType = types.find(t => t.typeKey === analysis.suggestedTypeKey);
  await db.update(imageUploads).set({
    aiQualityScore: analysis.quality.score,
    aiContentType: analysis.content.type,
    aiQualityIssues: analysis.quality.issues,
    aiSuggestedTypeId: suggestedType?.id || null,
    aiSuggestionConfidence: analysis.classification.confidence,
    aiAnalysisJson: analysis,
    status: "analyzed",
    updatedAt: new Date(),
  }).where(eq(imageUploads.id, upload.id));

  // Brand check if configured
  let brandResult = undefined;
  if (config.brandProfileId) {
    const [brand] = await db.select().from(brandProfiles).where(eq(brandProfiles.id, config.brandProfileId));
    if (brand) {
      const palette = [brand.primaryColor];
      if (brand.secondaryColor) palette.push(brand.secondaryColor);
      if (brand.accentColor) palette.push(brand.accentColor);
      if (brand.neutralColor) palette.push(brand.neutralColor);
      brandResult = analyzeBrandConsistency(analysis.content.dominant_colors, {
        palette,
        forbidden: brand.forbiddenColors || [],
        tolerance: brand.tolerance,
      });
    }
  }

  // Evaluate gate
  const evaluation = evaluateGate(
    config,
    { quality: analysis.quality, content: analysis.content },
    { width: meta.width, height: meta.height, sizeKb: meta.sizeKb },
    brandResult
  );

  // Store result
  await db.insert(gateResults).values({
    gateConfigId: gateId,
    imageUploadId: upload.id,
    verdict: evaluation.verdict,
    qualityScore: evaluation.quality_score,
    failures: evaluation.failures,
    warnings: evaluation.warnings,
    metadataJson: { analysis, evaluation, brand: brandResult || null },
    source,
    sourceReference: sourceReference || null,
  });

  return evaluation;
}

// POST /api/v1/quality-gates/:id/validate — Upload + analyze + evaluate
qualityGatesRouter.post("/:id/validate", async (c) => {
  const gateId = c.req.param("id");
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const source = (formData.get("source") as string) || "api";
    const sourceReference = formData.get("source_reference") as string | null;

    const validation = validateFile(file);
    if (!validation.valid) return c.json({ error: validation.error }, 400);

    const buffer = Buffer.from(await file!.arrayBuffer());
    const evaluation = await runValidation(gateId, buffer, file!.name, source, sourceReference || undefined);
    return c.json(evaluation);
  } catch (err: any) {
    if (err.status) return c.json({ error: err.message }, err.status);
    console.error("Gate validate error:", err);
    return c.json({ error: "Erro na validação" }, 500);
  }
});

// POST /api/v1/quality-gates/:id/validate-url — Download from URL + validate
qualityGatesRouter.post("/:id/validate-url", async (c) => {
  const gateId = c.req.param("id");
  try {
    const body = await c.req.json();
    if (!body.url) return c.json({ error: "url é obrigatório" }, 400);

    const response = await fetch(body.url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return c.json({ error: `Falha ao baixar imagem: HTTP ${response.status}` }, 400);

    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = body.url.split("/").pop() || "url-image";
    const evaluation = await runValidation(gateId, buffer, filename, body.source || "api", body.source_reference);
    return c.json(evaluation);
  } catch (err: any) {
    if (err.status) return c.json({ error: err.message }, err.status);
    console.error("Gate validate-url error:", err);
    return c.json({ error: "Erro na validação por URL" }, 500);
  }
});

// GET /api/v1/quality-gates/:id/history — Gate results history
qualityGatesRouter.get("/:id/history", async (c) => {
  const gateId = c.req.param("id");
  const verdictFilter = c.req.query("verdict");
  const page = parseInt(c.req.query("page") || "1");
  const perPage = parseInt(c.req.query("per_page") || "20");
  const offset = (page - 1) * perPage;

  let query = db.select().from(gateResults).where(eq(gateResults.gateConfigId, gateId));

  const results = await db.select().from(gateResults)
    .where(eq(gateResults.gateConfigId, gateId))
    .orderBy(desc(gateResults.checkedAt))
    .limit(perPage)
    .offset(offset);

  const filtered = verdictFilter
    ? results.filter(r => r.verdict === verdictFilter)
    : results;

  return c.json({ results: filtered, page, perPage });
});

// ── Webhook Endpoint ─────────────────────────

qualityGatesRouter.post("/webhook", async (c) => {
  try {
    const rawBody = await c.req.text();
    const body = JSON.parse(rawBody);

    if (!body.gate_id) return c.json({ error: "gate_id é obrigatório" }, 400);

    const [config] = await db.select().from(qualityGateConfigs).where(eq(qualityGateConfigs.id, body.gate_id));
    if (!config) return c.json({ error: "Quality gate não encontrado" }, 404);

    // Verify signature if secret is configured
    if (config.webhookSecret) {
      const signature = c.req.header("X-Woli-Signature") || "";
      if (!verifyWebhookSignature(rawBody, signature, config.webhookSecret)) {
        return c.json({ error: "Assinatura inválida" }, 401);
      }
    }

    if (!body.image_url) return c.json({ error: "image_url é obrigatório" }, 400);

    // Process async
    (async () => {
      try {
        const response = await fetch(body.image_url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) return;

        const buffer = Buffer.from(await response.arrayBuffer());
        const filename = body.image_url.split("/").pop() || "webhook-image";
        const evaluation = await runValidation(
          body.gate_id, buffer, filename, "webhook", body.source_reference
        );

        // POST to callback_url if provided
        if (body.callback_url) {
          await fetch(body.callback_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(evaluation),
            signal: AbortSignal.timeout(10000),
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Webhook processing error:", err);
      }
    })();

    return c.json({ status: "accepted" }, 202);
  } catch (err) {
    console.error("Webhook error:", err);
    return c.json({ error: "Erro no webhook" }, 500);
  }
});

export { qualityGatesRouter };
