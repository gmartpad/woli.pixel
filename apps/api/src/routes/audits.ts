import { Hono } from "hono";
import { db } from "../db";
import { auditJobs, auditItems, imageTypes } from "../db/schema";
import { eq, asc, desc, sql } from "drizzle-orm";
import { analyzeImage } from "../services/ai";
import { extractMetadata } from "../services/upload-validator";
import { storeAuditImage, getImageBuffer, batchDeleteObjects } from "../services/storage";

const auditsRouter = new Hono();
const AUDIT_AI_CONCURRENCY = parseInt(process.env.AUDIT_AI_CONCURRENCY || "3");
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

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

// POST /api/v1/audits — Create audit job
auditsRouter.post("/", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    if (!body.name) return c.json({ error: "name é obrigatório" }, 400);

    const threshold = body.pass_threshold ?? 7;
    if (threshold < 1 || threshold > 10) return c.json({ error: "pass_threshold deve ser entre 1 e 10" }, 400);

    const [job] = await db.insert(auditJobs).values({
      name: body.name,
      description: body.description || null,
      passThreshold: threshold,
      status: "created",
    }).returning();

    return c.json(job, 201);
  } catch (err) {
    console.error("Audit create error:", err);
    return c.json({ error: "Erro ao criar auditoria" }, 500);
  }
});

// POST /api/v1/audits/:id/upload — Upload images to audit
auditsRouter.post("/:id/upload", async (c) => {
  const id = c.req.param("id");
  try {
    const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, id));
    if (!job) return c.json({ error: "Auditoria não encontrada" }, 404);

    const formData = await c.req.formData();

    const files: File[] = [];
    for (const [, value] of formData.entries()) {
      if (typeof value === "object" && value !== null && "arrayBuffer" in value && "type" in value) {
        const f = value as File;
        if (ALLOWED_TYPES.includes(f.type)) files.push(f);
      }
    }

    if (files.length === 0) return c.json({ error: "Nenhum arquivo válido enviado" }, 400);

    const created = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const meta = await extractMetadata(buffer);

      // Store in S3
      const s3Key = await storeAuditImage(id, file.name, buffer, file.type);

      const [item] = await db.insert(auditItems).values({
        auditJobId: id,
        originalFilename: file.name,
        originalWidth: meta.width,
        originalHeight: meta.height,
        originalSizeKb: meta.sizeKb,
        originalFormat: meta.format,
        s3Key,
        status: "pending",
      }).returning();
      created.push(item);
    }

    await db.update(auditJobs).set({
      totalImages: job.totalImages + created.length,
      updatedAt: new Date(),
    }).where(eq(auditJobs.id, id));

    return c.json({ uploaded: created.length }, 201);
  } catch (err) {
    console.error("Audit upload error:", err);
    return c.json({ error: "Erro ao fazer upload para auditoria" }, 500);
  }
});

// POST /api/v1/audits/:id/add-urls — Add images by URL
auditsRouter.post("/:id/add-urls", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, id));
    if (!job) return c.json({ error: "Auditoria não encontrada" }, 404);

    const urls: string[] = body.urls || [];
    if (urls.length === 0) return c.json({ error: "Nenhuma URL fornecida" }, 400);

    let added = 0;
    let errors = 0;

    for (const url of urls) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const buffer = Buffer.from(await response.arrayBuffer());
        const meta = await extractMetadata(buffer);
        const filename = url.split("/").pop() || `url-image-${Date.now()}`;

        // Infer content type
        const contentType = meta.format === "png" ? "image/png"
          : meta.format === "gif" ? "image/gif"
          : meta.format === "webp" ? "image/webp"
          : "image/jpeg";

        // Store in S3
        const s3Key = await storeAuditImage(id, filename, buffer, contentType);

        await db.insert(auditItems).values({
          auditJobId: id,
          sourceUrl: url,
          originalFilename: filename,
          originalWidth: meta.width,
          originalHeight: meta.height,
          originalSizeKb: meta.sizeKb,
          originalFormat: meta.format,
          s3Key,
          status: "pending",
        });
        added++;
      } catch {
        await db.insert(auditItems).values({
          auditJobId: id,
          sourceUrl: url,
          originalFilename: url.split("/").pop() || "unknown",
          status: "error",
          errorMessage: `Falha ao baixar: ${url}`,
        });
        errors++;
      }
    }

    await db.update(auditJobs).set({
      totalImages: job.totalImages + added + errors,
      errorImages: job.errorImages + errors,
      sourceType: "url_list",
      updatedAt: new Date(),
    }).where(eq(auditJobs.id, id));

    return c.json({ added, errors }, 201);
  } catch (err) {
    console.error("Audit add-urls error:", err);
    return c.json({ error: "Erro ao adicionar URLs" }, 500);
  }
});

// POST /api/v1/audits/:id/scan — Start scanning
auditsRouter.post("/:id/scan", async (c) => {
  const id = c.req.param("id");
  try {
    const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, id));
    if (!job) return c.json({ error: "Auditoria não encontrada" }, 404);

    const items = await db.select().from(auditItems).where(eq(auditItems.auditJobId, id));
    const pending = items.filter(i => i.status === "pending");
    if (pending.length === 0) return c.json({ error: "Nenhuma imagem pendente para escanear" }, 400);
    if (job.status === "scanning") return c.json({ error: "Escaneamento já em andamento" }, 409);

    await db.update(auditJobs).set({ status: "scanning", updatedAt: new Date() }).where(eq(auditJobs.id, id));

    const types = await db.select().from(imageTypes);

    const tasks = pending.map((item) => async () => {
      if (!item.s3Key) throw new Error("Arquivo não disponível");

      await db.update(auditItems).set({ status: "scanning" }).where(eq(auditItems.id, item.id));

      // Read from S3
      const imageBuffer = await getImageBuffer(item.s3Key);
      const base64 = Buffer.from(imageBuffer).toString("base64");
      const fmt = item.originalFormat || "jpeg";
      const mimeType = fmt === "png" ? "image/png" : fmt === "gif" ? "image/gif" : fmt === "webp" ? "image/webp" : "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const analysis = await analyzeImage(dataUrl, types);

      await db.update(auditItems).set({
        qualityScore: analysis.quality.score,
        contentType: analysis.content.type,
        qualityIssues: analysis.quality.issues,
        suggestedTypeKey: analysis.suggestedTypeKey,
        suggestionConfidence: analysis.classification.confidence,
        dominantColors: analysis.content.dominant_colors,
        analysisJson: analysis,
        status: "scanned",
        updatedAt: new Date(),
      }).where(eq(auditItems.id, item.id));

      return analysis.quality.score;
    });

    // Run scanning async
    withConcurrency(tasks, AUDIT_AI_CONCURRENCY).then(async (results) => {
      let scanned = 0, passed = 0, failed = 0, errored = 0;
      const scores: number[] = [];

      for (const [i, r] of results.entries()) {
        if (r.status === "fulfilled") {
          scanned++;
          const score = r.value as number;
          scores.push(score);
          if (score >= job.passThreshold) passed++;
          else failed++;
        } else {
          errored++;
          const item = pending[i];
          if (item) {
            await db.update(auditItems).set({
              status: "error",
              errorMessage: r.reason instanceof Error ? r.reason.message : "Erro no escaneamento",
              updatedAt: new Date(),
            }).where(eq(auditItems.id, item.id)).catch(() => {});
          }
        }
      }

      const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;

      // Generate report
      const allItems = await db.select().from(auditItems).where(eq(auditItems.auditJobId, id));
      const scannedItems = allItems.filter(i => i.status === "scanned");

      const issueFreq: Record<string, number> = {};
      const contentDist: Record<string, number> = {};
      const formatDist: Record<string, number> = {};

      for (const item of scannedItems) {
        if (item.qualityIssues) {
          for (const issue of item.qualityIssues) {
            issueFreq[issue] = (issueFreq[issue] || 0) + 1;
          }
        }
        if (item.contentType) contentDist[item.contentType] = (contentDist[item.contentType] || 0) + 1;
        if (item.originalFormat) formatDist[item.originalFormat] = (formatDist[item.originalFormat] || 0) + 1;
      }

      const topIssues = Object.entries(issueFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([issue, count]) => ({ issue, count, percentage: Math.round((count / scannedItems.length) * 100) }));

      const scoreDist: Record<string, number> = { "1-2": 0, "3-4": 0, "5-6": 0, "7-8": 0, "9-10": 0 };
      for (const s of scores) {
        if (s <= 2) scoreDist["1-2"]++;
        else if (s <= 4) scoreDist["3-4"]++;
        else if (s <= 6) scoreDist["5-6"]++;
        else if (s <= 8) scoreDist["7-8"]++;
        else scoreDist["9-10"]++;
      }

      const sortedScores = [...scores].sort((a, b) => a - b);
      const median = sortedScores.length > 0
        ? sortedScores.length % 2 === 0
          ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
          : sortedScores[Math.floor(sortedScores.length / 2)]
        : 0;

      const totalSizeKb = scannedItems.reduce((sum, i) => sum + (i.originalSizeKb || 0), 0);
      const worstOffenders = scannedItems
        .filter(i => i.qualityScore !== null)
        .sort((a, b) => (a.qualityScore || 0) - (b.qualityScore || 0))
        .slice(0, 10)
        .map(i => ({ filename: i.originalFilename, score: i.qualityScore!, issues: i.qualityIssues || [] }));

      const report = {
        summary: { total: scannedItems.length + errored, passed, failed, errors: errored, avg_score: avgScore ? parseFloat(avgScore) : 0, median_score: median },
        score_distribution: scoreDist,
        top_issues: topIssues,
        content_type_distribution: contentDist,
        format_distribution: formatDist,
        size_stats: {
          avg_kb: scannedItems.length > 0 ? Math.round(totalSizeKb / scannedItems.length) : 0,
          total_mb: Math.round(totalSizeKb / 1024 * 10) / 10,
          oversized_count: scannedItems.filter(i => (i.originalSizeKb || 0) > 1024).length,
        },
        worst_offenders: worstOffenders,
      };

      await db.update(auditJobs).set({
        scannedImages: scanned,
        passedImages: passed,
        failedImages: failed,
        errorImages: job.errorImages + errored,
        avgQualityScore: avgScore,
        reportJson: report,
        status: "completed",
        updatedAt: new Date(),
      }).where(eq(auditJobs.id, id));
    });

    return c.json({ status: "scanning", pending: pending.length }, 202);
  } catch (err) {
    console.error("Audit scan error:", err);
    return c.json({ error: "Erro ao iniciar escaneamento" }, 500);
  }
});

// GET /api/v1/audits — List all audits
auditsRouter.get("/", async (c) => {
  const audits = await db.select().from(auditJobs).orderBy(desc(auditJobs.createdAt));
  return c.json(audits);
});

// GET /api/v1/audits/:id — Get audit details with paginated items
auditsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, id));
  if (!job) return c.json({ error: "Auditoria não encontrada" }, 404);

  const page = parseInt(c.req.query("page") || "1");
  const perPage = parseInt(c.req.query("per_page") || "20");
  const offset = (page - 1) * perPage;

  const items = await db.select().from(auditItems)
    .where(eq(auditItems.auditJobId, id))
    .orderBy(asc(auditItems.originalFilename))
    .limit(perPage)
    .offset(offset);

  return c.json({ ...job, items, page, perPage });
});

// GET /api/v1/audits/:id/report — Get report
auditsRouter.get("/:id/report", async (c) => {
  const id = c.req.param("id");
  const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, id));
  if (!job) return c.json({ error: "Auditoria não encontrada" }, 404);
  if (job.status !== "completed") return c.json({ error: "Auditoria ainda não concluída" }, 400);
  return c.json(job.reportJson);
});

// GET /api/v1/audits/:id/report/export — Export as CSV
auditsRouter.get("/:id/report/export", async (c) => {
  const id = c.req.param("id");
  const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, id));
  if (!job) return c.json({ error: "Auditoria não encontrada" }, 404);

  const items = await db.select().from(auditItems).where(eq(auditItems.auditJobId, id));

  const header = "filename,format,width,height,size_kb,quality_score,content_type,suggested_type,status,issues\n";
  const rows = items.map(i =>
    `"${i.originalFilename}","${i.originalFormat || ""}",${i.originalWidth || 0},${i.originalHeight || 0},${i.originalSizeKb || 0},${i.qualityScore || ""},${i.contentType || ""},${i.suggestedTypeKey || ""},${i.status},"${(i.qualityIssues || []).join("; ")}"`
  ).join("\n");

  const csv = header + rows;
  const safeName = job.name.replace(/[^a-zA-Z0-9_-]/g, "_");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria_${safeName}.csv"`,
    },
  });
});

// DELETE /api/v1/audits/:id — Delete audit
auditsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, id));
  if (!job) return c.json({ error: "Auditoria não encontrada" }, 404);

  // Collect S3 keys for cleanup
  const items = await db.select({ s3Key: auditItems.s3Key })
    .from(auditItems)
    .where(eq(auditItems.auditJobId, id));

  const s3Keys = items.map(i => i.s3Key).filter((k): k is string => k !== null);

  // Delete DB records
  await db.delete(auditItems).where(eq(auditItems.auditJobId, id));
  await db.delete(auditJobs).where(eq(auditJobs.id, id));

  // Clean up S3 objects
  if (s3Keys.length > 0) {
    await batchDeleteObjects(s3Keys).catch(() => {});
  }

  return c.json({ deleted: true });
});

export { auditsRouter };
