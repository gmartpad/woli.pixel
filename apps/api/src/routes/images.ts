import { Hono } from "hono";
import { db } from "../db";
import { imageUploads, imageTypes } from "../db/schema";
import { eq } from "drizzle-orm";
import { analyzeImage, generateExplanation } from "../services/ai";
import { processImage } from "../services/image-processor";
import sharp from "sharp";
import path from "path";
import { mkdir } from "fs/promises";

const imagesRouter = new Hono();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB || "10")) * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

// POST /api/v1/images/upload — Upload file, extract metadata via Sharp, return ID + info
imagesRouter.post("/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ error: "Nenhum arquivo enviado" }, 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({
        error: "Formato não suportado. Aceitos: PNG, JPEG, GIF, WebP"
      }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({
        error: `Arquivo muito grande. Máximo: ${process.env.MAX_FILE_SIZE_MB || 10} MB`
      }, 400);
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract metadata with Sharp
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(buffer).metadata();

    // Save file to disk
    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = file.name.split(".").pop() || "jpg";
    const timestamp = Date.now();
    const savedFilename = `${timestamp}-${file.name}`;
    const filePath = path.join(UPLOAD_DIR, savedFilename);
    await Bun.write(filePath, buffer);

    // Determine format
    const format = metadata.format || ext;

    // Insert into database
    const [upload] = await db.insert(imageUploads).values({
      originalFilename: file.name,
      originalFormat: format,
      originalWidth: metadata.width || 0,
      originalHeight: metadata.height || 0,
      originalSizeKb: Math.round(file.size / 1024),
      originalPath: filePath,
      status: "uploaded",
    }).returning();

    return c.json({
      id: upload.id,
      filename: upload.originalFilename,
      format: upload.originalFormat,
      width: upload.originalWidth,
      height: upload.originalHeight,
      sizeKb: upload.originalSizeKb,
      status: upload.status,
      metadata: {
        density: metadata.density || null,
        space: metadata.space || null,
        channels: metadata.channels || null,
        depth: metadata.depth || null,
        hasAlpha: metadata.hasAlpha || false,
        hasProfile: metadata.hasProfile || false,
        isProgressive: metadata.isProgressive || false,
        orientation: metadata.orientation || null,
      },
    }, 201);
  } catch (err) {
    console.error("Upload error:", err);
    return c.json({ error: "Erro ao processar upload" }, 500);
  }
});

// POST /api/v1/images/:id/analyze — Send to AI pipeline (Steps 1+2)
imagesRouter.post("/:id/analyze", async (c) => {
  const id = c.req.param("id");

  try {
    // Get the upload record
    const [upload] = await db.select().from(imageUploads).where(eq(imageUploads.id, id));
    if (!upload) {
      return c.json({ error: "Upload não encontrado" }, 404);
    }

    // Check if already analyzed (return cached result)
    if (upload.status === "analyzed" && upload.aiAnalysisJson) {
      return c.json(upload.aiAnalysisJson);
    }

    // Get all image types for classification context
    const types = await db.select().from(imageTypes);

    // Read the file for AI analysis
    const fileBuffer = await Bun.file(upload.originalPath!).arrayBuffer();
    const base64 = Buffer.from(fileBuffer).toString("base64");
    const mimeType = upload.originalFormat === "png" ? "image/png"
      : upload.originalFormat === "gif" ? "image/gif"
      : upload.originalFormat === "webp" ? "image/webp"
      : "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Run AI analysis pipeline (Steps 1 + 2)
    const analysisResult = await analyzeImage(dataUrl, types);

    // Find the suggested type ID
    const suggestedType = types.find(t => t.typeKey === analysisResult.suggestedTypeKey);

    // Update database with analysis results
    await db.update(imageUploads).set({
      aiQualityScore: analysisResult.quality.score,
      aiContentType: analysisResult.content.type,
      aiQualityIssues: analysisResult.quality.issues,
      aiSuggestedTypeId: suggestedType?.id || null,
      aiSuggestionConfidence: analysisResult.classification.confidence,
      aiAnalysisJson: analysisResult,
      status: "analyzed",
      updatedAt: new Date(),
    }).where(eq(imageUploads.id, id));

    return c.json({
      quality: analysisResult.quality,
      content: analysisResult.content,
      suggested_type: {
        image_type_id: suggestedType?.id || null,
        type_key: analysisResult.suggestedTypeKey,
        display_name: suggestedType?.displayName || analysisResult.classification.suggestedType,
        confidence: analysisResult.classification.confidence,
        reasoning: analysisResult.classification.reasoning,
      },
      crop_suggestion: analysisResult.cropSuggestion,
    });
  } catch (err) {
    console.error("Analysis error:", err);

    // Update status to error
    await db.update(imageUploads).set({
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Erro desconhecido na análise",
      updatedAt: new Date(),
    }).where(eq(imageUploads.id, id));

    return c.json({ error: "Erro na análise da imagem. Tente selecionar o tipo manualmente." }, 500);
  }
});

// GET /api/v1/images/:id — Get upload details + current status
imagesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [upload] = await db.select().from(imageUploads).where(eq(imageUploads.id, id));

  if (!upload) {
    return c.json({ error: "Upload não encontrado" }, 404);
  }

  return c.json(upload);
});

// POST /api/v1/images/:id/process — Validate + adjust (Sharp) + explain (GPT-4.1-mini)
imagesRouter.post("/:id/process", async (c) => {
  const id = c.req.param("id");

  try {
    let body: { target_type_id?: string; crop?: { x: number; y: number; width: number; height: number } };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Body JSON inválido" }, 400);
    }
    const targetTypeId = body.target_type_id;

    if (!targetTypeId) {
      return c.json({ error: "target_type_id é obrigatório" }, 400);
    }

    // Get upload and target type
    const [upload] = await db.select().from(imageUploads).where(eq(imageUploads.id, id));
    if (!upload) return c.json({ error: "Upload não encontrado" }, 404);

    const [targetType] = await db.select().from(imageTypes).where(eq(imageTypes.id, targetTypeId));
    if (!targetType) return c.json({ error: "Tipo de imagem não encontrado" }, 404);

    // Update target type
    await db.update(imageUploads).set({
      targetImageTypeId: targetTypeId,
      status: "processing",
      updatedAt: new Date(),
    }).where(eq(imageUploads.id, id));

    // Process image with Sharp
    const processResult = await processImage(upload.originalPath!, targetType, body.crop);

    // Generate AI explanation (Step 3 of pipeline)
    const explanation = await generateExplanation(
      {
        width: upload.originalWidth,
        height: upload.originalHeight,
        format: upload.originalFormat,
        sizeKb: upload.originalSizeKb,
      },
      {
        width: processResult.processedWidth,
        height: processResult.processedHeight,
        format: processResult.processedFormat,
        sizeKb: processResult.processedSizeKb,
      },
      processResult.adjustments,
      targetType.displayName
    );

    // Update database
    await db.update(imageUploads).set({
      processedWidth: processResult.processedWidth,
      processedHeight: processResult.processedHeight,
      processedFormat: processResult.processedFormat,
      processedSizeKb: processResult.processedSizeKb,
      adjustmentsMade: processResult.adjustments,
      aiExplanation: explanation,
      processedPath: processResult.processedPath,
      status: "processed",
      updatedAt: new Date(),
    }).where(eq(imageUploads.id, id));

    return c.json({
      status: "completed",
      original: {
        width: upload.originalWidth,
        height: upload.originalHeight,
        format: upload.originalFormat,
        size_kb: upload.originalSizeKb,
      },
      processed: {
        width: processResult.processedWidth,
        height: processResult.processedHeight,
        format: processResult.processedFormat,
        size_kb: processResult.processedSizeKb,
      },
      adjustments: processResult.adjustments,
      explanation,
      download_url: `/api/v1/images/${id}/download`,
    });
  } catch (err) {
    console.error("Process error:", err);
    await db.update(imageUploads).set({
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Erro no processamento",
      updatedAt: new Date(),
    }).where(eq(imageUploads.id, id));
    return c.json({ error: "Erro ao processar imagem" }, 500);
  }
});

// GET /api/v1/images/:id/download — Download processed image
imagesRouter.get("/:id/download", async (c) => {
  const id = c.req.param("id");
  const [upload] = await db.select().from(imageUploads).where(eq(imageUploads.id, id));

  if (!upload || !upload.processedPath) {
    return c.json({ error: "Imagem processada não encontrada" }, 404);
  }

  const file = Bun.file(upload.processedPath);
  const buffer = await file.arrayBuffer();

  const mimeMap: Record<string, string> = {
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };

  const requestedFormat = c.req.query("format"); // "png" | "jpg" | "webp" | undefined
  const storedFormat = upload.processedFormat || "jpeg";

  let finalBuffer: ArrayBuffer | Buffer = buffer;
  let finalFormat = storedFormat;

  if (
    requestedFormat &&
    requestedFormat !== storedFormat &&
    requestedFormat !== (storedFormat === "jpeg" ? "jpg" : storedFormat)
  ) {
    const converted = sharp(Buffer.from(buffer));
    if (requestedFormat === "png") converted.png();
    else if (requestedFormat === "jpg" || requestedFormat === "jpeg") converted.jpeg({ quality: 85, mozjpeg: true });
    else if (requestedFormat === "webp") converted.webp({ quality: 85 });
    finalBuffer = await converted.toBuffer();
    finalFormat = requestedFormat === "jpg" ? "jpeg" : requestedFormat;
  }

  const contentType = mimeMap[finalFormat] || "application/octet-stream";
  const ext = finalFormat === "jpeg" ? "jpg" : finalFormat;
  const downloadName = upload.originalFilename.replace(/\.[^.]+$/, `_processed.${ext}`);

  const responseBody = finalBuffer instanceof ArrayBuffer ? finalBuffer : new Uint8Array(finalBuffer);
  return new Response(responseBody, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${downloadName}"`,
    },
  });
});

export { imagesRouter };
