import { Hono } from "hono";
import { db } from "../db";
import { batchJobs, imageUploads, imageTypes } from "../db/schema";
import { eq, asc } from "drizzle-orm";
import { validateFile, extractMetadata } from "../services/upload-validator";
import { analyzeImage, generateExplanation } from "../services/ai";
import { processImage } from "../services/image-processor";
import { storeOriginal, storeProcessed, getImageBuffer } from "../services/storage";

const batchesRouter = new Hono();
const BATCH_AI_CONCURRENCY = parseInt(process.env.BATCH_AI_CONCURRENCY || "3");

// POST /api/v1/batches — Create batch job
batchesRouter.post("/", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const [batch] = await db.insert(batchJobs).values({
      name: body.name || null,
      status: "pending",
    }).returning();
    return c.json({ id: batch.id, status: batch.status }, 201);
  } catch (err) {
    console.error("Batch create error:", err);
    return c.json({ error: "Erro ao criar lote" }, 500);
  }
});

// POST /api/v1/batches/:batchId/upload — Upload single file to batch
batchesRouter.post("/:batchId/upload", async (c) => {
  const batchId = c.req.param("batchId");
  try {
    const [batch] = await db.select().from(batchJobs).where(eq(batchJobs.id, batchId));
    if (!batch) return c.json({ error: "Lote não encontrado" }, 404);

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const validation = validateFile(file);
    if (!validation.valid) return c.json({ error: validation.error }, 400);

    const buffer = Buffer.from(await file!.arrayBuffer());
    const meta = await extractMetadata(buffer);

    const newIndex = batch.totalImages + 1;

    // Insert DB record first to get upload ID
    const [upload] = await db.insert(imageUploads).values({
      originalFilename: file!.name,
      originalFormat: meta.format,
      originalWidth: meta.width,
      originalHeight: meta.height,
      originalSizeKb: meta.sizeKb,
      status: "uploaded",
      batchId: batchId,
      batchIndex: newIndex,
    }).returning();

    // Store original in S3
    const s3Key = await storeOriginal(upload.id, file!.name, buffer, file!.type);

    // Update with S3 key
    await db.update(imageUploads).set({
      originalS3Key: s3Key,
    }).where(eq(imageUploads.id, upload.id));

    await db.update(batchJobs).set({
      totalImages: newIndex,
      status: batch.status === "pending" ? "uploading" : batch.status,
      updatedAt: new Date(),
    }).where(eq(batchJobs.id, batchId));

    return c.json({
      id: upload.id,
      batchIndex: newIndex,
      filename: upload.originalFilename,
      format: meta.format,
      width: meta.width,
      height: meta.height,
      sizeKb: meta.sizeKb,
    }, 201);
  } catch (err) {
    console.error("Batch upload error:", err);
    return c.json({ error: "Erro ao fazer upload no lote" }, 500);
  }
});

// Helper: run async tasks with concurrency limit
async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      try {
        const value = await tasks[currentIndex]();
        results[currentIndex] = { status: "fulfilled", value };
      } catch (reason) {
        results[currentIndex] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

// POST /api/v1/batches/:batchId/analyze — Analyze all images in batch
batchesRouter.post("/:batchId/analyze", async (c) => {
  const batchId = c.req.param("batchId");
  try {
    const [batch] = await db.select().from(batchJobs).where(eq(batchJobs.id, batchId));
    if (!batch) return c.json({ error: "Lote não encontrado" }, 404);

    const uploads = await db.select().from(imageUploads).where(eq(imageUploads.batchId, batchId)).orderBy(asc(imageUploads.batchIndex));
    if (uploads.length === 0) return c.json({ error: "Nenhuma imagem no lote" }, 400);

    if (batch.status === "analyzing") return c.json({ error: "Análise já em andamento" }, 409);

    await db.update(batchJobs).set({ status: "analyzing", updatedAt: new Date() }).where(eq(batchJobs.id, batchId));

    const types = await db.select().from(imageTypes);

    const tasks = uploads.map((upload) => async () => {
      if (upload.status === "analyzed" && upload.aiAnalysisJson) return;

      // Read from S3
      const imageBuffer = await getImageBuffer(upload.originalS3Key!);
      const base64 = Buffer.from(imageBuffer).toString("base64");
      const mimeType = upload.originalFormat === "png" ? "image/png"
        : upload.originalFormat === "gif" ? "image/gif"
        : upload.originalFormat === "webp" ? "image/webp"
        : "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const analysisResult = await analyzeImage(dataUrl, types);
      const suggestedType = types.find(t => t.typeKey === analysisResult.suggestedTypeKey);

      await db.update(imageUploads).set({
        aiQualityScore: analysisResult.quality.score,
        aiContentType: analysisResult.content.type,
        aiQualityIssues: analysisResult.quality.issues,
        aiSuggestedTypeId: suggestedType?.id || null,
        aiSuggestionConfidence: analysisResult.classification.confidence,
        aiAnalysisJson: analysisResult,
        status: "analyzed",
        updatedAt: new Date(),
      }).where(eq(imageUploads.id, upload.id));
    });

    // Run analysis with concurrency limit (non-blocking)
    withConcurrency(tasks, BATCH_AI_CONCURRENCY).then(async (results) => {
      let completed = 0;
      let failed = 0;
      for (const r of results) {
        if (r.status === "fulfilled") completed++;
        else {
          failed++;
          const upload = uploads[results.indexOf(r)];
          if (upload) {
            await db.update(imageUploads).set({
              status: "error",
              errorMessage: r.reason instanceof Error ? r.reason.message : "Erro na análise",
              updatedAt: new Date(),
            }).where(eq(imageUploads.id, upload.id)).catch(() => {});
          }
        }
      }
      await db.update(batchJobs).set({
        completedImages: completed,
        failedImages: failed,
        status: "analyzed",
        updatedAt: new Date(),
      }).where(eq(batchJobs.id, batchId));
    });

    return c.json({ status: "analyzing", total: uploads.length }, 202);
  } catch (err) {
    console.error("Batch analyze error:", err);
    return c.json({ error: "Erro ao iniciar análise do lote" }, 500);
  }
});

// POST /api/v1/batches/:batchId/process — Process all analyzed images
batchesRouter.post("/:batchId/process", async (c) => {
  const batchId = c.req.param("batchId");
  try {
    const body = await c.req.json().catch(() => ({}));
    const defaultTypeId: string | undefined = body.default_type_id;
    const overrides: Record<string, string> = body.overrides || {};
    const crops: Record<string, { x: number; y: number; width: number; height: number }> = body.crops || {};

    const [batch] = await db.select().from(batchJobs).where(eq(batchJobs.id, batchId));
    if (!batch) return c.json({ error: "Lote não encontrado" }, 404);

    const uploads = await db.select().from(imageUploads).where(eq(imageUploads.batchId, batchId)).orderBy(asc(imageUploads.batchIndex));
    const analyzedUploads = uploads.filter(u => u.status === "analyzed");
    if (analyzedUploads.length === 0) return c.json({ error: "Nenhuma imagem analisada para processar" }, 400);

    await db.update(batchJobs).set({ status: "processing", updatedAt: new Date() }).where(eq(batchJobs.id, batchId));

    const allTypes = await db.select().from(imageTypes);

    const tasks = analyzedUploads.map((upload) => async () => {
      const targetTypeId = overrides[upload.id] || defaultTypeId || upload.aiSuggestedTypeId;
      if (!targetTypeId) throw new Error("Nenhum tipo alvo definido");

      const targetType = allTypes.find(t => t.id === targetTypeId);
      if (!targetType) throw new Error("Tipo de imagem não encontrado");

      await db.update(imageUploads).set({
        targetImageTypeId: targetTypeId,
        status: "processing",
        updatedAt: new Date(),
      }).where(eq(imageUploads.id, upload.id));

      // Get image from S3 and process in memory
      const imageBuffer = await getImageBuffer(upload.originalS3Key!);
      const imageCrop = crops[upload.id] || undefined;
      const processResult = await processImage(imageBuffer, targetType, imageCrop);

      // Store processed result in S3
      const processedS3Key = await storeProcessed(upload.id, processResult.processedBuffer, processResult.processedFormat);

      const explanation = await generateExplanation(
        { width: upload.originalWidth, height: upload.originalHeight, format: upload.originalFormat, sizeKb: upload.originalSizeKb },
        { width: processResult.processedWidth, height: processResult.processedHeight, format: processResult.processedFormat, sizeKb: processResult.processedSizeKb },
        processResult.adjustments,
        targetType.displayName
      );

      await db.update(imageUploads).set({
        processedWidth: processResult.processedWidth,
        processedHeight: processResult.processedHeight,
        processedFormat: processResult.processedFormat,
        processedSizeKb: processResult.processedSizeKb,
        adjustmentsMade: processResult.adjustments,
        aiExplanation: explanation,
        processedS3Key,
        status: "processed",
        updatedAt: new Date(),
      }).where(eq(imageUploads.id, upload.id));
    });

    withConcurrency(tasks, BATCH_AI_CONCURRENCY).then(async (results) => {
      let completed = 0;
      let failed = 0;
      for (const [i, r] of results.entries()) {
        if (r.status === "fulfilled") {
          completed++;
        } else {
          failed++;
          const upload = analyzedUploads[i];
          if (upload) {
            await db.update(imageUploads).set({
              status: "error",
              errorMessage: r.reason instanceof Error ? r.reason.message : "Erro no processamento",
              updatedAt: new Date(),
            }).where(eq(imageUploads.id, upload.id)).catch(() => {});
          }
        }
      }
      await db.update(batchJobs).set({
        completedImages: completed,
        failedImages: failed,
        status: "processed",
        updatedAt: new Date(),
      }).where(eq(batchJobs.id, batchId));
    });

    return c.json({ status: "processing", total: analyzedUploads.length }, 202);
  } catch (err) {
    console.error("Batch process error:", err);
    return c.json({ error: "Erro ao processar lote" }, 500);
  }
});

// GET /api/v1/batches/:batchId — Get batch details with all images
batchesRouter.get("/:batchId", async (c) => {
  const batchId = c.req.param("batchId");
  const [batch] = await db.select().from(batchJobs).where(eq(batchJobs.id, batchId));
  if (!batch) return c.json({ error: "Lote não encontrado" }, 404);

  const uploads = await db.select().from(imageUploads).where(eq(imageUploads.batchId, batchId)).orderBy(asc(imageUploads.batchIndex));

  return c.json({
    ...batch,
    images: uploads.map(u => ({
      id: u.id,
      batchIndex: u.batchIndex,
      filename: u.originalFilename,
      format: u.originalFormat,
      width: u.originalWidth,
      height: u.originalHeight,
      sizeKb: u.originalSizeKb,
      status: u.status,
      qualityScore: u.aiQualityScore,
      contentType: u.aiContentType,
      suggestedTypeId: u.aiSuggestedTypeId,
      suggestionConfidence: u.aiSuggestionConfidence,
      selectedTypeId: u.targetImageTypeId,
      processedWidth: u.processedWidth,
      processedHeight: u.processedHeight,
      processedFormat: u.processedFormat,
      processedSizeKb: u.processedSizeKb,
      adjustments: u.adjustmentsMade,
      explanation: u.aiExplanation,
      error: u.errorMessage,
    })),
  });
});

// GET /api/v1/batches — List all batches
batchesRouter.get("/", async (c) => {
  const batches = await db.select().from(batchJobs).orderBy(batchJobs.createdAt);
  return c.json(batches);
});

export { batchesRouter };
