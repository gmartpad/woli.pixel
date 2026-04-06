export type ImageTypeCandidate = {
  id: string;
  width: number | null;
  height: number | null;
};

export type MatchResult = {
  typeId: string;
  matchScore: number;
};

const VARIABLE_FALLBACK_SCORE = 0.2;
const MIN_FIXED_SCORE = 0.3;

/**
 * Match a single image to the best-fitting type preset.
 *
 * Score = 1 - (0.7 * arDiff + 0.3 * areaDiff)
 *   arDiff   = |imgAR - typeAR| / max(imgAR, typeAR)
 *   areaDiff = |imgArea - typeArea| / max(imgArea, typeArea)
 *
 * Variable-dimension types (null w/h) are fallbacks with score 0.2,
 * used only when no fixed type scores above 0.3.
 */
export function matchImageToType(
  imgW: number,
  imgH: number,
  types: ImageTypeCandidate[],
): MatchResult | null {
  if (imgW <= 0 || imgH <= 0 || types.length === 0) return null;

  const imgAR = imgW / imgH;
  const imgArea = imgW * imgH;

  let bestFixed: MatchResult | null = null;
  let bestVariable: MatchResult | null = null;

  for (const t of types) {
    if (t.width == null || t.height == null) {
      // Variable-dimension type — fallback candidate
      if (!bestVariable) {
        bestVariable = { typeId: t.id, matchScore: VARIABLE_FALLBACK_SCORE };
      }
      continue;
    }

    if (t.width <= 0 || t.height <= 0) continue;

    const typeAR = t.width / t.height;
    const typeArea = t.width * t.height;

    const arDiff = Math.abs(imgAR - typeAR) / Math.max(imgAR, typeAR);
    const areaDiff = Math.abs(imgArea - typeArea) / Math.max(imgArea, typeArea);
    const score = 1 - (0.7 * arDiff + 0.3 * areaDiff);

    if (!bestFixed || score > bestFixed.matchScore) {
      bestFixed = { typeId: t.id, matchScore: score };
    }
  }

  if (bestFixed && bestFixed.matchScore >= MIN_FIXED_SCORE) {
    return bestFixed;
  }

  return bestVariable ?? bestFixed;
}

/**
 * Match a batch of images to type presets.
 */
export function matchBatchImages(
  images: { width: number; height: number }[],
  types: ImageTypeCandidate[],
): (MatchResult | null)[] {
  return images.map((img) => matchImageToType(img.width, img.height, types));
}
