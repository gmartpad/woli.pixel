// CIE Delta-E 2000 color distance for brand consistency checking

export type BrandConsistencyResult = {
  score: number;
  issues: string[];
  color_matches: Array<{
    image_color: string;
    closest_brand_color: string;
    distance: number;
    within_tolerance: boolean;
  }>;
  has_forbidden_colors: boolean;
  forbidden_matches: string[];
};

type BrandColors = {
  palette: string[];       // brand colors (hex)
  forbidden: string[];     // forbidden colors (hex)
  tolerance: number;       // max Delta-E before flagging (0-100)
};

// ── Color Conversion ─────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB → linear RGB
  let rl = r / 255;
  let gl = g / 255;
  let bl = b / 255;

  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

  // linear RGB → XYZ (D65)
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.00000;
  let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

  const epsilon = 0.008856;
  const kappa = 903.3;

  x = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116;

  return [
    116 * y - 16,       // L
    500 * (x - y),      // a
    200 * (y - z),      // b
  ];
}

export function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return rgbToLab(r, g, b);
}

// ── CIE Delta-E 2000 ─────────────────────────

export function deltaE2000(
  lab1: [number, number, number],
  lab2: [number, number, number]
): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const kL = 1, kC = 1, kH = 1;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab = (C1 + C2) / 2;

  const Cab7 = Math.pow(Cab, 7);
  const G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * (180 / Math.PI);
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2, a2p) * (180 / Math.PI);
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;

  let hp: number;
  if (C1p * C2p === 0) {
    hp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hp = (h1p + h2p + 360) / 2;
  } else {
    hp = (h1p + h2p - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos(((hp - 30) * Math.PI) / 180)
    + 0.24 * Math.cos((2 * hp * Math.PI) / 180)
    + 0.32 * Math.cos(((3 * hp + 6) * Math.PI) / 180)
    - 0.20 * Math.cos(((4 * hp - 63) * Math.PI) / 180);

  const SL = 1 + (0.015 * Math.pow(Lp - 50, 2)) / Math.sqrt(20 + Math.pow(Lp - 50, 2));
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;

  const Cp7 = Math.pow(Cp, 7);
  const RT = -2 * Math.sqrt(Cp7 / (Cp7 + Math.pow(25, 7)))
    * Math.sin((60 * Math.exp(-Math.pow((hp - 275) / 25, 2)) * Math.PI) / 180);

  return Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );
}

// ── Brand Consistency Analysis ───────────────

export function findClosestBrandColor(
  imageColor: string,
  brandColors: string[]
): { color: string; distance: number } {
  if (brandColors.length === 0) {
    return { color: "", distance: Infinity };
  }

  const imgLab = hexToLab(imageColor);
  let closest = { color: brandColors[0], distance: Infinity };

  for (const bc of brandColors) {
    const bcLab = hexToLab(bc);
    const dist = deltaE2000(imgLab, bcLab);
    if (dist < closest.distance) {
      closest = { color: bc, distance: dist };
    }
  }

  return closest;
}

export function analyzeBrandConsistency(
  dominantColors: string[],
  brand: BrandColors
): BrandConsistencyResult {
  if (brand.palette.length === 0) {
    return {
      score: 100,
      issues: [],
      color_matches: [],
      has_forbidden_colors: false,
      forbidden_matches: [],
    };
  }

  const color_matches: BrandConsistencyResult["color_matches"] = [];
  const issues: string[] = [];
  let score = 100;

  // Check each dominant color against brand palette
  for (const imgColor of dominantColors) {
    const closest = findClosestBrandColor(imgColor, brand.palette);
    const withinTolerance = closest.distance <= brand.tolerance;
    color_matches.push({
      image_color: imgColor,
      closest_brand_color: closest.color,
      distance: Math.round(closest.distance * 10) / 10,
      within_tolerance: withinTolerance,
    });

    if (!withinTolerance) {
      const excess = closest.distance - brand.tolerance;
      const deduction = Math.min(30, Math.round(excess * 1.5));
      score -= deduction;
      issues.push(
        `Cor ${imgColor} está distante da paleta da marca (ΔE=${closest.distance.toFixed(1)}, tolerância=${brand.tolerance})`
      );
    }
  }

  // Check forbidden colors
  const forbiddenMatches: string[] = [];
  for (const imgColor of dominantColors) {
    const imgLab = hexToLab(imgColor);
    for (const fc of brand.forbidden) {
      const fcLab = hexToLab(fc);
      const dist = deltaE2000(imgLab, fcLab);
      if (dist < 15) { // Close enough to a forbidden color
        forbiddenMatches.push(fc);
        score -= 20;
        issues.push(`Cor ${imgColor} é semelhante à cor proibida ${fc}`);
      }
    }
  }

  return {
    score: Math.max(0, score),
    issues,
    color_matches,
    has_forbidden_colors: forbiddenMatches.length > 0,
    forbidden_matches: [...new Set(forbiddenMatches)],
  };
}
