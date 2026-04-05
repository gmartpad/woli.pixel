import sharp from "sharp";
import path from "path";
import { mkdir } from "fs/promises";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

export type ImageTypeSpec = {
  id: string;
  typeKey: string;
  displayName: string;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  maxFileSizeKb: number;
  allowedFormats: string[];
  recommendedFormat: string;
  requiresTransparency: boolean | null;
  minWidth: number | null;
};

export type ProcessResult = {
  processedPath: string;
  processedWidth: number;
  processedHeight: number;
  processedFormat: string;
  processedSizeKb: number;
  adjustments: string[];
};

export async function processImage(
  originalPath: string,
  targetSpec: ImageTypeSpec,
  crop?: { x: number; y: number; width: number; height: number }
): Promise<ProcessResult> {
  const adjustments: string[] = [];

  // Read original image
  let pipeline = sharp(originalPath);
  const metadata = await sharp(originalPath).metadata();
  let originalWidth = metadata.width || 0;
  let originalHeight = metadata.height || 0;

  // Step 0: Apply user crop before any other processing
  if (crop) {
    pipeline = pipeline.extract({
      left: crop.x,
      top: crop.y,
      width: crop.width,
      height: crop.height,
    });
    adjustments.push("user_cropped");
    originalWidth = crop.width;
    originalHeight = crop.height;
  }

  // Step 1: Resize if target has fixed dimensions
  const useTransparentContain = targetSpec.requiresTransparency === true;

  if (targetSpec.width && targetSpec.height) {
    if (originalWidth !== targetSpec.width || originalHeight !== targetSpec.height) {
      if (useTransparentContain) {
        // Gamification/icon types: contain with transparent background (no crop)
        pipeline = pipeline.resize(targetSpec.width, targetSpec.height, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      } else {
        pipeline = pipeline.resize(targetSpec.width, targetSpec.height, {
          fit: "cover",
          position: "centre",
        });
      }
      adjustments.push("resized");

      // If aspect ratio differs significantly, it's also a crop (only for cover fit)
      if (!useTransparentContain) {
        const originalRatio = originalWidth / originalHeight;
        const targetRatio = targetSpec.width / targetSpec.height;
        if (Math.abs(originalRatio - targetRatio) > 0.1) {
          adjustments.push("smart_cropped");
        }
      }
    }
  } else if (targetSpec.minWidth && originalWidth < targetSpec.minWidth) {
    // Variable width type but image is too small
    pipeline = pipeline.resize(targetSpec.minWidth, null, {
      fit: "inside",
      withoutEnlargement: false,
    });
    adjustments.push("resized");
  }

  // Step 2: Format conversion
  let outputFormat = targetSpec.recommendedFormat;
  const originalFormat = metadata.format || "jpeg";

  // Normalize format names
  const formatMap: Record<string, string> = {
    jpg: "jpeg",
    jpeg: "jpeg",
    png: "png",
    gif: "gif",
    webp: "webp",
  };

  const normalizedTarget = formatMap[outputFormat] || outputFormat;
  const normalizedOriginal = formatMap[originalFormat] || originalFormat;

  if (normalizedOriginal !== normalizedTarget) {
    adjustments.push("format_converted");
  }

  // Step 3: Apply format and compression
  const maxSizeBytes = targetSpec.maxFileSizeKb * 1024;

  if (normalizedTarget === "jpeg") {
    // Start with quality 85 and reduce if needed
    let quality = 85;
    let buffer = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();

    while (buffer.length > maxSizeBytes && quality > 20) {
      quality -= 10;
      buffer = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    }

    if (buffer.length < metadata.size!) {
      adjustments.push("compressed");
    }

    // Save the final buffer
    await mkdir(UPLOAD_DIR, { recursive: true });
    const outputFilename = `processed-${Date.now()}.jpg`;
    const outputPath = path.join(UPLOAD_DIR, outputFilename);
    await Bun.write(outputPath, buffer);

    const processedMeta = await sharp(buffer).metadata();
    return {
      processedPath: outputPath,
      processedWidth: processedMeta.width || targetSpec.width || originalWidth,
      processedHeight: processedMeta.height || targetSpec.height || originalHeight,
      processedFormat: "jpeg",
      processedSizeKb: Math.round(buffer.length / 1024),
      adjustments,
    };
  } else if (normalizedTarget === "png") {
    let buffer = await pipeline.clone().png({ compressionLevel: 9 }).toBuffer();

    // If still too large, try with palette mode
    if (buffer.length > maxSizeBytes) {
      buffer = await pipeline.clone().png({ compressionLevel: 9, palette: true }).toBuffer();
    }

    if (buffer.length < metadata.size!) {
      adjustments.push("compressed");
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const outputFilename = `processed-${Date.now()}.png`;
    const outputPath = path.join(UPLOAD_DIR, outputFilename);
    await Bun.write(outputPath, buffer);

    const processedMeta = await sharp(buffer).metadata();
    return {
      processedPath: outputPath,
      processedWidth: processedMeta.width || targetSpec.width || originalWidth,
      processedHeight: processedMeta.height || targetSpec.height || originalHeight,
      processedFormat: "png",
      processedSizeKb: Math.round(buffer.length / 1024),
      adjustments,
    };
  } else {
    // WebP or other
    let quality = 85;
    let buffer = await pipeline.clone().webp({ quality }).toBuffer();

    while (buffer.length > maxSizeBytes && quality > 20) {
      quality -= 10;
      buffer = await pipeline.clone().webp({ quality }).toBuffer();
    }

    if (buffer.length < metadata.size!) {
      adjustments.push("compressed");
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const outputFilename = `processed-${Date.now()}.webp`;
    const outputPath = path.join(UPLOAD_DIR, outputFilename);
    await Bun.write(outputPath, buffer);

    const processedMeta = await sharp(buffer).metadata();
    return {
      processedPath: outputPath,
      processedWidth: processedMeta.width || targetSpec.width || originalWidth,
      processedHeight: processedMeta.height || targetSpec.height || originalHeight,
      processedFormat: "webp",
      processedSizeKb: Math.round(buffer.length / 1024),
      adjustments,
    };
  }
}
