import sharp from "sharp";

export type TransparencyAnalysis = {
  has_alpha_channel: boolean;
  transparency_percentage: number;
  background_is_solid: boolean;
  edge_transparency: boolean;
  issues: string[];
};

export async function analyzeTransparency(imagePath: string): Promise<TransparencyAnalysis> {
  const metadata = await sharp(imagePath).metadata();
  const hasAlpha = metadata.hasAlpha === true && (metadata.channels === 4);

  if (!hasAlpha) {
    return {
      has_alpha_channel: false,
      transparency_percentage: 0,
      background_is_solid: true,
      edge_transparency: false,
      issues: ["Imagem não possui canal alfa (transparência)"],
    };
  }

  // Downsample to max 256x256 for pixel analysis performance
  const analysisSize = 256;
  const { data, info } = await sharp(imagePath)
    .resize(analysisSize, analysisSize, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;
  const channels = info.channels; // Should be 4 (RGBA)
  let transparentCount = 0;

  for (let i = 0; i < totalPixels; i++) {
    const alpha = data[i * channels + 3];
    if (alpha < 128) transparentCount++;
  }

  const transparencyPercentage = Math.round((transparentCount / totalPixels) * 100);

  // Check edge transparency: sample border pixels (top row, bottom row, left col, right col)
  let edgeTransparentCount = 0;
  let edgeTotalCount = 0;
  const w = info.width;
  const h = info.height;

  for (let x = 0; x < w; x++) {
    // Top row
    if (data[(x) * channels + 3] < 128) edgeTransparentCount++;
    edgeTotalCount++;
    // Bottom row
    if (data[((h - 1) * w + x) * channels + 3] < 128) edgeTransparentCount++;
    edgeTotalCount++;
  }
  for (let y = 1; y < h - 1; y++) {
    // Left col
    if (data[(y * w) * channels + 3] < 128) edgeTransparentCount++;
    edgeTotalCount++;
    // Right col
    if (data[(y * w + w - 1) * channels + 3] < 128) edgeTransparentCount++;
    edgeTotalCount++;
  }

  const edgeTransparency = edgeTotalCount > 0 && (edgeTransparentCount / edgeTotalCount) > 0.5;

  // Check if opaque area forms a solid rectangle (solid background indicator)
  // Find bounding box of opaque pixels
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * channels + 3] >= 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const opaqueCount = totalPixels - transparentCount;
  const boundingBoxArea = (maxX - minX + 1) * (maxY - minY + 1);
  // If opaque pixels fill >95% of their bounding box, it's a solid rectangle
  const backgroundIsSolid = boundingBoxArea > 0 && (opaqueCount / boundingBoxArea) > 0.95;

  // Generate issues in Portuguese
  const issues: string[] = [];
  if (transparencyPercentage === 0) {
    issues.push("Imagem possui canal alfa mas sem pixels transparentes");
  }
  if (backgroundIsSolid && transparencyPercentage > 0 && transparencyPercentage < 50) {
    issues.push("Fundo sólido detectado — o ícone deve ter fundo transparente");
  }
  if (!edgeTransparency && transparencyPercentage < 20) {
    issues.push("Bordas opacas — recorte pode ser necessário para uso como ícone");
  }

  return {
    has_alpha_channel: true,
    transparency_percentage: transparencyPercentage,
    background_is_solid: backgroundIsSolid,
    edge_transparency: edgeTransparency,
    issues,
  };
}
