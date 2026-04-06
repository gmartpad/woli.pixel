import { Hono } from "hono";
import sharp from "sharp";
import archiver from "archiver";
import { Readable } from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { db } from "../db";
import { sql, eq, inArray } from "drizzle-orm";
import { buildDateRange } from "../services/history-query";
import { getImageBuffer, deleteFromS3 } from "../services/storage";
import { s3Client, BUCKET } from "../lib/s3";
import { generationJobs, imageUploads, imageCrops } from "../db/schema";
import type { DatePreset, HistoryItem, HistoryResponse } from "../services/history-query";

const historyRouter = new Hono();

// ── Allowed filter values (controlled sets) ──────────────────────
const VALID_MODES = new Set(["all", "generation", "upload", "crop"]);
const VALID_STATUSES = new Set(["all", "completed", "error"]);
const VALID_CATEGORIES = new Set(["admin", "content", "gamification", "user", "custom"]);
const VALID_MODELS = new Set(["recraft_v3", "flux2_pro"]);
const VALID_QUALITIES = new Set(["low", "medium", "high"]);
const VALID_DATE_PRESETS = new Set(["today", "yesterday", "this_week", "this_month", "all"]);

// ── SQL injection safety ─────────────────────────────────────────
function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

// ── Build WHERE clauses ──────────────────────────────────────────
function buildWhereClause(
  source: "generation" | "upload",
  params: {
    status: string;
    categories: string[] | null;
    model: string | null;
    quality: string | null;
    search: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  },
): string {
  const conditions: string[] = [];

  // Status filter
  if (params.status === "completed") {
    if (source === "upload") {
      conditions.push("iu.status IN ('processed', 'completed')");
    } else {
      conditions.push("gj.status = 'completed'");
    }
  } else if (params.status === "error") {
    if (source === "upload") {
      conditions.push("iu.status = 'error'");
    } else {
      conditions.push("gj.status = 'error'");
    }
  } else {
    // "all" — show completed + error only (not pending/processing)
    if (source === "upload") {
      conditions.push("iu.status IN ('processed', 'completed', 'error')");
    } else {
      conditions.push("gj.status IN ('completed', 'error')");
    }
  }

  // Category filter
  if (params.categories && params.categories.length > 0) {
    const cats = params.categories.map((c) => `'${c}'`).join(", ");
    conditions.push(`it.category IN (${cats})`);
  }

  // Generation-only filters
  if (source === "generation") {
    if (params.model) {
      conditions.push(`gj.model = '${params.model}'`);
    }
    if (params.quality) {
      conditions.push(`gj.quality_tier = '${params.quality}'`);
    }
  }

  // Search filter
  if (params.search) {
    const escaped = escapeSql(params.search);
    const matchesPersonalizado = "personalizado".includes(params.search.toLowerCase());
    const nullTypeCondition = matchesPersonalizado ? " OR it.display_name IS NULL" : "";
    if (source === "generation") {
      conditions.push(`(gj.prompt ILIKE '%${escaped}%' OR gj.enhanced_prompt ILIKE '%${escaped}%' OR it.display_name ILIKE '%${escaped}%' OR gj.display_name ILIKE '%${escaped}%'${nullTypeCondition})`);
    } else {
      conditions.push(`(iu.original_filename ILIKE '%${escaped}%' OR it.display_name ILIKE '%${escaped}%' OR iu.display_name ILIKE '%${escaped}%'${nullTypeCondition})`);
    }
  }

  // Date filters
  const dateCol = source === "generation" ? "gj.created_at" : "iu.created_at";
  if (params.dateFrom) {
    conditions.push(`${dateCol} >= '${escapeSql(params.dateFrom)}'`);
  }
  if (params.dateTo) {
    conditions.push(`${dateCol} <= '${escapeSql(params.dateTo)}'`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
}

// ── Build generation SELECT ──────────────────────────────────────
function buildGenerationSelect(where: string): string {
  return `
    SELECT
      gj.id,
      'generation' AS mode,
      gj.status,
      gj.created_at,
      COALESCE(it.category, 'custom') AS category,
      COALESCE(gj.display_name, it.display_name, 'Personalizado') AS image_type_name,
      gj.display_name AS display_name,
      COALESCE(gj.target_size_w, gj.generation_size_w) AS final_width,
      COALESCE(gj.target_size_h, gj.generation_size_h) AS final_height,
      gj.processed_format AS final_format,
      gj.processed_size_kb AS final_size_kb,
      gj.prompt,
      gj.enhanced_prompt,
      gj.model,
      gj.quality_tier,
      gj.cost_usd,
      NULL AS original_filename,
      NULL::integer AS original_width,
      NULL::integer AS original_height,
      NULL::integer AS original_size_kb,
      NULL::integer AS ai_quality_score,
      gj.processed_s3_key
    FROM generation_jobs gj
    LEFT JOIN image_types it ON gj.image_type_id = it.id
    ${where}
  `;
}

// ── Build upload SELECT ──────────────────────────────────────────
function buildUploadSelect(where: string): string {
  return `
    SELECT
      iu.id,
      'upload' AS mode,
      CASE WHEN iu.status = 'processed' THEN 'completed' ELSE iu.status END AS status,
      iu.created_at,
      COALESCE(it.category, 'custom') AS category,
      COALESCE(iu.display_name, it.display_name, 'Personalizado') AS image_type_name,
      iu.display_name AS display_name,
      iu.processed_width AS final_width,
      iu.processed_height AS final_height,
      iu.processed_format AS final_format,
      iu.processed_size_kb AS final_size_kb,
      NULL AS prompt,
      NULL AS enhanced_prompt,
      NULL AS model,
      NULL AS quality_tier,
      NULL AS cost_usd,
      iu.original_filename,
      iu.original_width,
      iu.original_height,
      iu.original_size_kb,
      iu.ai_quality_score,
      iu.processed_s3_key
    FROM image_uploads iu
    LEFT JOIN image_types it ON iu.target_image_type_id = it.id
    ${where}
  `;
}

// ── Build crop SELECT ────────────────────────────────────────────
function buildCropSelect(whereParams: {
  status: string;
  search: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}): string {
  const conditions: string[] = [];

  if (whereParams.status === "completed") {
    conditions.push("ic.status = 'completed'");
  } else if (whereParams.status === "error") {
    conditions.push("ic.status = 'error'");
  } else {
    conditions.push("ic.status IN ('completed', 'error')");
  }

  if (whereParams.search) {
    const escaped = escapeSql(whereParams.search);
    conditions.push(`(ic.original_filename ILIKE '%${escaped}%' OR 'Recorte' ILIKE '%${escaped}%' OR ic.display_name ILIKE '%${escaped}%')`);
  }

  if (whereParams.dateFrom) {
    conditions.push(`ic.created_at >= '${escapeSql(whereParams.dateFrom)}'`);
  }
  if (whereParams.dateTo) {
    conditions.push(`ic.created_at <= '${escapeSql(whereParams.dateTo)}'`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return `
    SELECT
      ic.id,
      'crop' AS mode,
      ic.status,
      ic.created_at,
      'custom' AS category,
      COALESCE(ic.display_name, 'Recorte') AS image_type_name,
      ic.display_name AS display_name,
      ic.cropped_width AS final_width,
      ic.cropped_height AS final_height,
      ic.cropped_format AS final_format,
      ic.cropped_size_kb AS final_size_kb,
      NULL AS prompt,
      NULL AS enhanced_prompt,
      NULL AS model,
      NULL AS quality_tier,
      NULL AS cost_usd,
      ic.original_filename,
      ic.original_width,
      ic.original_height,
      ic.original_size_kb,
      NULL::integer AS ai_quality_score,
      ic.cropped_s3_key AS processed_s3_key
    FROM image_crops ic
    ${where}
  `;
}

// ── Map row to HistoryItem ───────────────────────────────────────
function mapRowToItem(row: Record<string, unknown>): HistoryItem {
  const id = String(row.id);
  const mode = row.mode as "generation" | "upload" | "crop";

  const thumbnailUrl = `/api/v1/history/${id}/thumbnail?mode=${row.mode}`;

  let downloadUrl: string;
  if (mode === "generation") {
    downloadUrl = `/api/v1/generate/${id}/download`;
  } else if (mode === "crop") {
    downloadUrl = `/api/v1/history/${id}/thumbnail?mode=crop`;
  } else {
    downloadUrl = `/api/v1/images/${id}/download`;
  }

  return {
    id,
    mode,
    status: String(row.status),
    createdAt: String(row.created_at),
    thumbnailUrl,
    downloadUrl,
    category: row.category != null ? String(row.category) : null,
    imageTypeName: row.image_type_name != null ? String(row.image_type_name) : null,
    displayName: row.display_name != null ? String(row.display_name) : null,
    finalWidth: row.final_width != null ? Number(row.final_width) : null,
    finalHeight: row.final_height != null ? Number(row.final_height) : null,
    finalFormat: row.final_format != null ? String(row.final_format) : null,
    finalSizeKb: row.final_size_kb != null ? Number(row.final_size_kb) : null,
    prompt: row.prompt != null ? String(row.prompt) : null,
    enhancedPrompt: row.enhanced_prompt != null ? String(row.enhanced_prompt) : null,
    model: row.model != null ? String(row.model) : null,
    qualityTier: row.quality_tier != null ? String(row.quality_tier) : null,
    costUsd: row.cost_usd != null ? Number(row.cost_usd) : null,
    originalFilename: row.original_filename != null ? String(row.original_filename) : null,
    originalWidth: row.original_width != null ? Number(row.original_width) : null,
    originalHeight: row.original_height != null ? Number(row.original_height) : null,
    originalSizeKb: row.original_size_kb != null ? Number(row.original_size_kb) : null,
    aiQualityScore: row.ai_quality_score != null ? Number(row.ai_quality_score) : null,
  };
}

// NOTE: This endpoint returns all history items without user scoping.
// The generationJobs and imageUploads tables do not have userId columns.
// This is by design for the hackathon single-tenant deployment.
// For multi-tenant production use, add userId columns and WHERE clauses.

// ── GET / — Unified history endpoint ─────────────────────────────
historyRouter.get("/", async (c) => {
  // Parse query params
  const page = Math.max(1, parseInt(c.req.query("page") || "1") || 1);
  const perPage = parseInt(c.req.query("per_page") || "24") || 24;

  if (perPage < 1 || perPage > 100) {
    return c.json({ error: "per_page deve ser entre 1 e 100" }, 400);
  }

  const mode = c.req.query("mode") || "all";
  const status = c.req.query("status") || "all";
  const categoryParam = c.req.query("category") || null;
  const modelParam = c.req.query("model") || null;
  const qualityParam = c.req.query("quality") || null;
  const searchParam = c.req.query("search") || null;
  const datePresetParam = c.req.query("date_preset") || null;
  const dateFromParam = c.req.query("date_from") || null;
  const dateToParam = c.req.query("date_to") || null;

  // Validate controlled sets
  if (!VALID_MODES.has(mode)) {
    return c.json({ error: "mode deve ser all, generation ou upload" }, 400);
  }
  if (!VALID_STATUSES.has(status)) {
    return c.json({ error: "status deve ser all, completed ou error" }, 400);
  }

  // Parse categories (comma-separated, validate each)
  let categories: string[] | null = null;
  if (categoryParam) {
    categories = categoryParam.split(",").filter((cat) => VALID_CATEGORIES.has(cat));
    if (categories.length === 0) categories = null;
  }

  // Validate model and quality
  const model = modelParam && VALID_MODELS.has(modelParam) ? modelParam : null;
  const quality = qualityParam && VALID_QUALITIES.has(qualityParam) ? qualityParam : null;

  // Resolve date range
  let dateFrom: string | null = null;
  let dateTo: string | null = null;

  if (datePresetParam && VALID_DATE_PRESETS.has(datePresetParam)) {
    const range = buildDateRange(datePresetParam as DatePreset);
    if (range.from) dateFrom = range.from.toISOString();
    if (range.to) dateTo = range.to.toISOString();
  }

  // Custom date range overrides preset (only if ISO 8601 format is valid)
  const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  if (dateFromParam && ISO_DATE_REGEX.test(dateFromParam)) dateFrom = dateFromParam;
  if (dateToParam && ISO_DATE_REGEX.test(dateToParam)) dateTo = dateToParam;

  // Determine which queries to include
  // model/quality are generation-only → skip uploads and crops when set
  const includeGeneration = mode === "all" || mode === "generation";
  const includeUpload = mode === "upload" || (mode === "all" && !model && !quality);
  const includeCrop = mode === "crop" || (mode === "all" && !model && !quality);

  const whereParams = { status, categories, model, quality, search: searchParam, dateFrom, dateTo };

  // Build the UNION query
  const parts: string[] = [];

  if (includeGeneration) {
    const where = buildWhereClause("generation", whereParams);
    parts.push(buildGenerationSelect(where));
  }

  if (includeUpload) {
    const where = buildWhereClause("upload", whereParams);
    parts.push(buildUploadSelect(where));
  }

  if (includeCrop) {
    parts.push(buildCropSelect({ status, search: searchParam, dateFrom, dateTo }));
  }

  const unionQuery = parts.join("\n    UNION ALL\n    ");
  const offset = (page - 1) * perPage;

  // Data query with pagination
  const dataQuery = `
    SELECT * FROM (
      ${unionQuery}
    ) AS history
    ORDER BY created_at DESC
    LIMIT ${perPage}
    OFFSET ${offset}
  `;

  // Count query
  const countQuery = `
    SELECT COUNT(*) AS total FROM (
      ${unionQuery}
    ) AS history_count
  `;

  // Execute both queries
  const [rawRows, rawCount] = await Promise.all([
    db.execute(sql.raw(dataQuery)),
    db.execute(sql.raw(countQuery)),
  ]);

  // Handle both array and { rows: [] } shapes (Drizzle driver variance)
  const rowArray = Array.isArray(rawRows) ? rawRows : (rawRows as any).rows ?? [];
  const countArray = Array.isArray(rawCount) ? rawCount : (rawCount as any).rows ?? [];
  const items = (rowArray as Record<string, unknown>[]).map(mapRowToItem);
  const total = Number((countArray as Record<string, unknown>[])[0]?.total ?? 0);
  const hasMore = page * perPage < total;

  const response: HistoryResponse = {
    items,
    total,
    page,
    perPage,
    hasMore,
  };

  return c.json(response);
});

// ── GET /:id/thumbnail — Serve resized JPEG thumbnail ─────────
historyRouter.get("/:id/thumbnail", async (c) => {
  const id = c.req.param("id");
  const mode = c.req.query("mode");

  if (mode !== "generation" && mode !== "upload" && mode !== "crop") {
    return c.json({ error: "mode deve ser generation, upload ou crop" }, 400);
  }

  // Look up processedS3Key from the correct table
  let rows: { key: string | null }[];

  if (mode === "generation") {
    rows = await db
      .select({ key: generationJobs.processedS3Key })
      .from(generationJobs)
      .where(eq(generationJobs.id, id));
  } else if (mode === "crop") {
    rows = await db
      .select({ key: imageCrops.croppedS3Key })
      .from(imageCrops)
      .where(eq(imageCrops.id, id));
  } else {
    rows = await db
      .select({ key: imageUploads.processedS3Key })
      .from(imageUploads)
      .where(eq(imageUploads.id, id));
  }

  if (rows.length === 0 || !rows[0].key) {
    return c.json({ error: "Imagem não encontrada" }, 404);
  }

  const s3Key = rows[0].key;

  // Download image buffer from S3
  const imageBuffer = await getImageBuffer(s3Key);

  // Resize with Sharp
  const thumbnail = await sharp(imageBuffer)
    .resize(400, null, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  return new Response(thumbnail, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

// ── POST /download — Bulk download as ZIP ─────────────────────
historyRouter.post("/download", async (c) => {
  const body = await c.req.json<{ ids: string[] }>();

  if (!body.ids || body.ids.length === 0) {
    return c.json({ error: "Nenhum item selecionado" }, 400);
  }

  // Gather files from all tables
  const generationRows = await db
    .select({
      id: generationJobs.id,
      processedS3Key: generationJobs.processedS3Key,
      processedFormat: generationJobs.processedFormat,
    })
    .from(generationJobs)
    .where(inArray(generationJobs.id, body.ids));

  const uploadRows = await db
    .select({
      id: imageUploads.id,
      processedS3Key: imageUploads.processedS3Key,
      processedFormat: imageUploads.processedFormat,
      originalFilename: imageUploads.originalFilename,
    })
    .from(imageUploads)
    .where(inArray(imageUploads.id, body.ids));

  const files: { key: string; name: string }[] = [];

  for (const row of generationRows) {
    if (row.processedS3Key) {
      const ext = row.processedFormat || "png";
      files.push({ key: row.processedS3Key, name: `${row.id}.${ext}` });
    }
  }

  for (const row of uploadRows) {
    if (row.processedS3Key) {
      const name = row.originalFilename || `${row.id}.${row.processedFormat || "png"}`;
      files.push({ key: row.processedS3Key, name });
    }
  }

  // Crop rows
  const cropRows = await db
    .select({
      id: imageCrops.id,
      croppedS3Key: imageCrops.croppedS3Key,
      croppedFormat: imageCrops.croppedFormat,
      originalFilename: imageCrops.originalFilename,
    })
    .from(imageCrops)
    .where(inArray(imageCrops.id, body.ids));

  for (const row of cropRows) {
    if (row.croppedS3Key) {
      const name = `cropped-${row.originalFilename || `${row.id}.${row.croppedFormat || "png"}`}`;
      files.push({ key: row.croppedS3Key, name });
    }
  }

  if (files.length === 0) {
    return c.json({ error: "Nenhum arquivo encontrado" }, 404);
  }

  // Create ZIP archive stream
  const archive = archiver("zip", { zlib: { level: 5 } });

  // Append each file from S3
  for (const file of files) {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: file.key });
    const response = await s3Client.send(command);
    if (response.Body) {
      // AWS SDK v3 Body has transformToWebStream(); convert to Node Readable for archiver
      const webStream = response.Body.transformToWebStream();
      const nodeStream = Readable.fromWeb(webStream);
      archive.append(nodeStream, { name: file.name });
    }
  }

  archive.finalize();

  // Convert Node stream to Web ReadableStream
  const webStream = Readable.toWeb(archive) as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="woli-pixel-images.zip"',
    },
  });
});

// ── DELETE /bulk — Bulk delete history items and S3 files ─────
historyRouter.delete("/bulk", async (c) => {
  const body = await c.req.json<{ items: { id: string; mode: string }[] }>();

  if (!body.items || body.items.length === 0) {
    return c.json({ error: "Nenhum item selecionado" }, 400);
  }

  // Validate all modes
  for (const item of body.items) {
    if (item.mode !== "generation" && item.mode !== "upload" && item.mode !== "crop") {
      return c.json({ error: `mode inválido: ${item.mode}` }, 400);
    }
  }

  const generationIds = body.items.filter((i) => i.mode === "generation").map((i) => i.id);
  const uploadIds = body.items.filter((i) => i.mode === "upload").map((i) => i.id);
  const cropIds = body.items.filter((i) => i.mode === "crop").map((i) => i.id);

  // Delete generations
  if (generationIds.length > 0) {
    const rows = await db
      .select({ id: generationJobs.id, processedS3Key: generationJobs.processedS3Key })
      .from(generationJobs)
      .where(inArray(generationJobs.id, generationIds));

    const s3Keys = rows.map((r) => r.processedS3Key).filter(Boolean) as string[];
    await Promise.all(s3Keys.map((key) => deleteFromS3(key)));
    await db.delete(generationJobs).where(inArray(generationJobs.id, generationIds));
  }

  // Delete uploads
  if (uploadIds.length > 0) {
    const rows = await db
      .select({
        id: imageUploads.id,
        originalS3Key: imageUploads.originalS3Key,
        processedS3Key: imageUploads.processedS3Key,
      })
      .from(imageUploads)
      .where(inArray(imageUploads.id, uploadIds));

    const s3Keys = rows.flatMap((r) => [r.originalS3Key, r.processedS3Key]).filter(Boolean) as string[];
    await Promise.all(s3Keys.map((key) => deleteFromS3(key)));
    await db.delete(imageUploads).where(inArray(imageUploads.id, uploadIds));
  }

  // Delete crops
  if (cropIds.length > 0) {
    const rows = await db
      .select({
        id: imageCrops.id,
        originalS3Key: imageCrops.originalS3Key,
        croppedS3Key: imageCrops.croppedS3Key,
      })
      .from(imageCrops)
      .where(inArray(imageCrops.id, cropIds));

    const s3Keys = rows.flatMap((r) => [r.originalS3Key, r.croppedS3Key]).filter(Boolean) as string[];
    await Promise.all(s3Keys.map((key) => deleteFromS3(key)));
    await db.delete(imageCrops).where(inArray(imageCrops.id, cropIds));
  }

  return new Response(null, { status: 204 });
});

// ── PATCH /:id/rename — Rename a history item ─────────────────
historyRouter.patch("/:id/rename", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ mode?: string; displayName?: string | null }>();

  const mode = body.mode;
  if (mode !== "generation" && mode !== "upload" && mode !== "crop") {
    return c.json({ error: "mode deve ser generation, upload ou crop" }, 400);
  }

  let displayName = body.displayName;
  if (displayName !== null && displayName !== undefined) {
    if (typeof displayName !== "string") {
      return c.json({ error: "displayName deve ser uma string ou null" }, 400);
    }
    displayName = displayName.trim();
    if (displayName.length === 0) {
      return c.json({ error: "displayName não pode ser vazio" }, 400);
    }
    if (displayName.length > 255) {
      return c.json({ error: "displayName não pode exceder 255 caracteres" }, 400);
    }
  } else {
    displayName = null;
  }

  const table =
    mode === "generation" ? generationJobs :
    mode === "crop" ? imageCrops :
    imageUploads;

  const result = await db
    .update(table)
    .set({ displayName })
    .where(eq(table.id, id));

  if ((result as any).rowCount === 0) {
    return c.json({ error: "Registro não encontrado" }, 404);
  }

  return c.json({ displayName });
});

// ── DELETE /:id — Delete history item and S3 files ────────────
historyRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const mode = c.req.query("mode");

  if (mode !== "generation" && mode !== "upload" && mode !== "crop") {
    return c.json({ error: "mode deve ser generation, upload ou crop" }, 400);
  }

  if (mode === "generation") {
    // Look up the generation job
    const rows = await db
      .select({ processedS3Key: generationJobs.processedS3Key })
      .from(generationJobs)
      .where(eq(generationJobs.id, id));

    if (rows.length === 0) {
      return c.json({ error: "Registro não encontrado" }, 404);
    }

    const record = rows[0];

    // Delete S3 file
    if (record.processedS3Key) {
      await deleteFromS3(record.processedS3Key);
    }

    // Delete DB row
    await db.delete(generationJobs).where(eq(generationJobs.id, id));
  } else if (mode === "crop") {
    const rows = await db
      .select({
        originalS3Key: imageCrops.originalS3Key,
        croppedS3Key: imageCrops.croppedS3Key,
      })
      .from(imageCrops)
      .where(eq(imageCrops.id, id));

    if (rows.length === 0) {
      return c.json({ error: "Registro não encontrado" }, 404);
    }

    const record = rows[0];
    const deletePromises: Promise<void>[] = [];
    if (record.originalS3Key) deletePromises.push(deleteFromS3(record.originalS3Key));
    if (record.croppedS3Key) deletePromises.push(deleteFromS3(record.croppedS3Key));
    await Promise.all(deletePromises);

    await db.delete(imageCrops).where(eq(imageCrops.id, id));
  } else {
    // Look up the upload
    const rows = await db
      .select({
        originalS3Key: imageUploads.originalS3Key,
        processedS3Key: imageUploads.processedS3Key,
      })
      .from(imageUploads)
      .where(eq(imageUploads.id, id));

    if (rows.length === 0) {
      return c.json({ error: "Registro não encontrado" }, 404);
    }

    const record = rows[0];

    // Delete both S3 files (original + processed)
    const deletePromises: Promise<void>[] = [];
    if (record.originalS3Key) {
      deletePromises.push(deleteFromS3(record.originalS3Key));
    }
    if (record.processedS3Key) {
      deletePromises.push(deleteFromS3(record.processedS3Key));
    }
    await Promise.all(deletePromises);

    // Delete DB row
    await db.delete(imageUploads).where(eq(imageUploads.id, id));
  }

  return new Response(null, { status: 204 });
});

export { historyRouter };
