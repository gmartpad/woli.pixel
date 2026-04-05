import sharp from "sharp";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB || "10")) * 1024 * 1024;

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export type ImageMetadata = {
  width: number;
  height: number;
  format: string;
  sizeKb: number;
  density?: number | null;
  space?: string | null;
  channels?: number | null;
  depth?: string | null;
  hasAlpha?: boolean;
  hasProfile?: boolean;
  isProgressive?: boolean;
  orientation?: number | null;
};

export function validateFile(file: File | null): ValidationResult {
  if (!file) {
    return { valid: false, error: "Nenhum arquivo enviado" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "Formato não suportado. Aceitos: PNG, JPEG, GIF, WebP" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `Arquivo muito grande. Máximo: ${process.env.MAX_FILE_SIZE_MB || 10} MB` };
  }

  return { valid: true };
}

export async function extractMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || "unknown",
    sizeKb: Math.round(buffer.length / 1024),
    density: metadata.density || null,
    space: metadata.space || null,
    channels: metadata.channels || null,
    depth: metadata.depth || null,
    hasAlpha: metadata.hasAlpha || false,
    hasProfile: metadata.hasProfile || false,
    isProgressive: metadata.isProgressive || false,
    orientation: metadata.orientation || null,
  };
}
