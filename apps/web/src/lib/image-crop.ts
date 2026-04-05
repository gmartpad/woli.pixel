/**
 * Canvas-based image cropping utility.
 * Adapted from crochet-tryon — simplified for local blob URLs (no S3/CORS handling).
 */

export type PixelCrop = { x: number; y: number; width: number; height: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to convert cropped canvas to blob"));
      },
      type,
      quality,
    );
  });
}

/**
 * Crops an image to the specified pixel region and returns a new File.
 */
export async function getCroppedImage(
  imageSrc: string,
  pixelCrop: PixelCrop,
  fileName: string,
  mimeType: string,
): Promise<File> {
  const img = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  const ctx = canvas.getContext("2d", { colorSpace: "srgb" });
  if (!ctx) throw new Error("Failed to get canvas 2d context");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  const quality = mimeType === "image/png" ? 1 : 0.92;
  const blob = await canvasToBlob(canvas, mimeType, quality);

  return new File([blob], fileName, { type: mimeType });
}
