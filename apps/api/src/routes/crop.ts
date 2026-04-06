import { Hono } from "hono";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "../db";
import { imageCrops } from "../db/schema";
import { storeCropOriginal, storeCropResult } from "../services/storage";
import { createPresignedDownloadUrl } from "../lib/s3";

const cropRouter = new Hono();

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ── POST / — Save cropped image (original + cropped to S3 + DB) ──
cropRouter.post("/", async (c) => {
  const formData = await c.req.formData();

  const original = formData.get("original") as File | null;
  const cropped = formData.get("cropped") as File | null;
  const cropX = parseInt(String(formData.get("crop_x") || "0"));
  const cropY = parseInt(String(formData.get("crop_y") || "0"));
  const cropW = parseInt(String(formData.get("crop_w") || "0"));
  const cropH = parseInt(String(formData.get("crop_h") || "0"));

  if (!original || !cropped) {
    return c.json({ error: "Campos original e cropped são obrigatórios" }, 400);
  }

  if (!ALLOWED_TYPES.has(original.type)) {
    return c.json({ error: "Formato de imagem não suportado" }, 400);
  }

  if (original.size > MAX_FILE_SIZE) {
    return c.json({ error: "Arquivo excede o limite de 10MB" }, 400);
  }

  if (cropW <= 0 || cropH <= 0) {
    return c.json({ error: "Coordenadas de recorte inválidas" }, 400);
  }

  try {
    // Read buffers
    const originalBuffer = Buffer.from(await original.arrayBuffer());
    const croppedBuffer = Buffer.from(await cropped.arrayBuffer());

    // Get metadata
    const originalMeta = await sharp(originalBuffer).metadata();
    const croppedMeta = await sharp(croppedBuffer).metadata();

    const originalFormat = originalMeta.format || "png";
    const croppedFormat = croppedMeta.format || "png";

    // Create DB row first to get the ID
    const [row] = await db.insert(imageCrops).values({
      originalFilename: original.name,
      originalFormat,
      originalWidth: originalMeta.width || 0,
      originalHeight: originalMeta.height || 0,
      originalSizeKb: Math.round(original.size / 1024),
      croppedWidth: croppedMeta.width || 0,
      croppedHeight: croppedMeta.height || 0,
      croppedFormat,
      croppedSizeKb: Math.round(cropped.size / 1024),
      cropX,
      cropY,
      cropW,
      cropH,
      status: "completed",
    }).returning({ id: imageCrops.id });

    const cropId = row.id;

    // Upload both files to S3
    const [originalS3Key, croppedS3Key] = await Promise.all([
      storeCropOriginal(cropId, original.name, originalBuffer, original.type),
      storeCropResult(cropId, croppedBuffer, croppedFormat),
    ]);

    // Update S3 keys in DB
    await db.update(imageCrops)
      .set({ originalS3Key, croppedS3Key })
      .where(eq(imageCrops.id, cropId));

    // Generate download URL
    const downloadUrl = await createPresignedDownloadUrl(croppedS3Key, `cropped-${original.name}`);

    return c.json({
      id: cropId,
      download_url: downloadUrl,
    });
  } catch (err) {
    console.error("Crop processing failed:", err);
    return c.json({ error: "Falha ao processar o recorte da imagem" }, 500);
  }
});

export { cropRouter };
