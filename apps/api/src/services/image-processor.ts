import sharp from "sharp";

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
  processedBuffer: Buffer;
  processedWidth: number;
  processedHeight: number;
  processedFormat: string;
  processedSizeKb: number;
  adjustments: string[];
};

export async function processImage(
  input: string | Buffer,
  targetSpec: ImageTypeSpec,
  crop?: { x: number; y: number; width: number; height: number }
): Promise<ProcessResult> {
  const adjustments: string[] = [];

  // Read original image — Sharp handles both path strings and Buffers natively
  let pipeline = sharp(input);
  const metadata = await sharp(input).metadata();
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

      if (!useTransparentContain) {
        const originalRatio = originalWidth / originalHeight;
        const targetRatio = targetSpec.width / targetSpec.height;
        if (Math.abs(originalRatio - targetRatio) > 0.1) {
          adjustments.push("smart_cropped");
        }
      }
    }
  } else if (targetSpec.minWidth && originalWidth < targetSpec.minWidth) {
    pipeline = pipeline.resize(targetSpec.minWidth, null, {
      fit: "inside",
      withoutEnlargement: false,
    });
    adjustments.push("resized");
  }

  // Step 2: Format conversion
  let outputFormat = targetSpec.recommendedFormat;
  const originalFormat = metadata.format || "jpeg";

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
    let quality = 85;
    let buffer = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();

    while (buffer.length > maxSizeBytes && quality > 20) {
      quality -= 10;
      buffer = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    }

    if (buffer.length < metadata.size!) {
      adjustments.push("compressed");
    }

    const processedMeta = await sharp(buffer).metadata();
    return {
      processedBuffer: buffer,
      processedWidth: processedMeta.width || targetSpec.width || originalWidth,
      processedHeight: processedMeta.height || targetSpec.height || originalHeight,
      processedFormat: "jpeg",
      processedSizeKb: Math.round(buffer.length / 1024),
      adjustments,
    };
  } else if (normalizedTarget === "png") {
    let buffer = await pipeline.clone().png({ compressionLevel: 9 }).toBuffer();

    if (buffer.length > maxSizeBytes) {
      buffer = await pipeline.clone().png({ compressionLevel: 9, palette: true }).toBuffer();
    }

    if (buffer.length < metadata.size!) {
      adjustments.push("compressed");
    }

    const processedMeta = await sharp(buffer).metadata();
    return {
      processedBuffer: buffer,
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

    const processedMeta = await sharp(buffer).metadata();
    return {
      processedBuffer: buffer,
      processedWidth: processedMeta.width || targetSpec.width || originalWidth,
      processedHeight: processedMeta.height || targetSpec.height || originalHeight,
      processedFormat: "webp",
      processedSizeKb: Math.round(buffer.length / 1024),
      adjustments,
    };
  }
}

/**
 * Post-process an AI-generated image to exact target dimensions and format.
 * Simpler than processImage — no user crop, no format detection needed.
 */
export async function postProcessGenerated(
  imageBuffer: Buffer,
  targetSpec: ImageTypeSpec,
): Promise<ProcessResult> {
  const adjustments: string[] = [];

  let pipeline = sharp(imageBuffer);
  const metadata = await sharp(imageBuffer).metadata();
  const srcW = metadata.width || 1024;
  const srcH = metadata.height || 1024;

  // Resize to target if target has fixed dimensions
  if (targetSpec.width && targetSpec.height) {
    if (srcW !== targetSpec.width || srcH !== targetSpec.height) {
      if (targetSpec.requiresTransparency) {
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
    }
  } else if (targetSpec.minWidth && srcW > targetSpec.minWidth) {
    pipeline = pipeline.resize(targetSpec.minWidth, null, { fit: "inside" });
    adjustments.push("resized");
  }

  // Format conversion and compression
  const outputFormat = targetSpec.recommendedFormat === "jpg" ? "jpeg" : targetSpec.recommendedFormat;
  const maxSizeBytes = targetSpec.maxFileSizeKb * 1024;

  let buffer: Buffer;
  if (outputFormat === "jpeg") {
    let quality = 85;
    buffer = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    while (buffer.length > maxSizeBytes && quality > 20) {
      quality -= 10;
      buffer = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    }
  } else if (outputFormat === "png") {
    buffer = await pipeline.clone().png({ compressionLevel: 9 }).toBuffer();
    if (buffer.length > maxSizeBytes) {
      buffer = await pipeline.clone().png({ compressionLevel: 9, palette: true }).toBuffer();
    }
  } else {
    let quality = 85;
    buffer = await pipeline.clone().webp({ quality }).toBuffer();
    while (buffer.length > maxSizeBytes && quality > 20) {
      quality -= 10;
      buffer = await pipeline.clone().webp({ quality }).toBuffer();
    }
  }

  if (buffer.length < imageBuffer.length) {
    adjustments.push("compressed");
  }

  const processedMeta = await sharp(buffer).metadata();
  return {
    processedBuffer: buffer,
    processedWidth: processedMeta.width || targetSpec.width || srcW,
    processedHeight: processedMeta.height || targetSpec.height || srcH,
    processedFormat: outputFormat,
    processedSizeKb: Math.round(buffer.length / 1024),
    adjustments,
  };
}
