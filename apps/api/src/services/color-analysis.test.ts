import { describe, test, expect } from "bun:test";
import {
  hexToLab,
  deltaE2000,
  findClosestBrandColor,
  analyzeBrandConsistency,
} from "./color-analysis";

// ── hexToLab ─────────────────────────────────────

describe("hexToLab", () => {
  test("#ffffff maps to L ~100, a ~0, b ~0", () => {
    const [L, a, b] = hexToLab("#ffffff");
    expect(L).toBeCloseTo(100, 0);
    expect(a).toBeCloseTo(0, 0);
    expect(b).toBeCloseTo(0, 0);
  });

  test("#000000 maps to L ~0, a ~0, b ~0", () => {
    const [L, a, b] = hexToLab("#000000");
    expect(L).toBeCloseTo(0, 0);
    expect(a).toBeCloseTo(0, 0);
    expect(b).toBeCloseTo(0, 0);
  });

  test("#ff0000 maps to L ~53 with a > 0 (red is positive on a-axis)", () => {
    const [L, a] = hexToLab("#ff0000");
    expect(L).toBeCloseTo(53, 0);
    expect(a).toBeGreaterThan(0);
  });

  test("case-insensitive: #aabbcc and #AABBCC produce the same result", () => {
    const lower = hexToLab("#aabbcc");
    const upper = hexToLab("#AABBCC");
    expect(lower[0]).toBeCloseTo(upper[0], 10);
    expect(lower[1]).toBeCloseTo(upper[1], 10);
    expect(lower[2]).toBeCloseTo(upper[2], 10);
  });
});

// ── deltaE2000 ───────────────────────────────────

describe("deltaE2000", () => {
  test("identical colors produce distance 0", () => {
    const lab = hexToLab("#3366cc");
    expect(deltaE2000(lab, lab)).toBe(0);
  });

  test("similar colors (close blues) produce distance < 5", () => {
    const blue1 = hexToLab("#3366cc");
    const blue2 = hexToLab("#3368cf");
    expect(deltaE2000(blue1, blue2)).toBeLessThan(5);
  });

  test("very different colors (red vs blue) produce distance > 20", () => {
    const red = hexToLab("#ff0000");
    const blue = hexToLab("#0000ff");
    expect(deltaE2000(red, blue)).toBeGreaterThan(20);
  });

  test("symmetric: deltaE(a, b) === deltaE(b, a)", () => {
    const lab1 = hexToLab("#ff8800");
    const lab2 = hexToLab("#0044aa");
    const d1 = deltaE2000(lab1, lab2);
    const d2 = deltaE2000(lab2, lab1);
    expect(d1).toBeCloseTo(d2, 10);
  });
});

// ── findClosestBrandColor ────────────────────────

describe("findClosestBrandColor", () => {
  test("exact match gives distance ~0", () => {
    const result = findClosestBrandColor("#ff0000", ["#ff0000", "#00ff00"]);
    expect(result.color).toBe("#ff0000");
    expect(result.distance).toBeCloseTo(0, 1);
  });

  test("picks nearest color when between two", () => {
    // A light blue should be closer to blue than to red
    const result = findClosestBrandColor("#5588dd", ["#ff0000", "#0000ff"]);
    expect(result.color).toBe("#0000ff");
  });

  test("empty palette returns distance Infinity", () => {
    const result = findClosestBrandColor("#ff0000", []);
    expect(result.color).toBe("");
    expect(result.distance).toBe(Infinity);
  });
});

// ── analyzeBrandConsistency ──────────────────────

describe("analyzeBrandConsistency", () => {
  test("perfect match (all within tolerance) gives score 100 and no issues", () => {
    const result = analyzeBrandConsistency(["#ff0000", "#00ff00"], {
      palette: ["#ff0000", "#00ff00"],
      forbidden: [],
      tolerance: 10,
    });
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.has_forbidden_colors).toBe(false);
    expect(result.forbidden_matches).toHaveLength(0);
  });

  test("mismatch produces score < 100 and non-empty issues", () => {
    const result = analyzeBrandConsistency(["#ff0000"], {
      palette: ["#0000ff"], // red vs blue = very far
      forbidden: [],
      tolerance: 5,
    });
    expect(result.score).toBeLessThan(100);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  test("forbidden color detected sets has_forbidden_colors and populates forbidden_matches", () => {
    const result = analyzeBrandConsistency(["#ff0000"], {
      palette: ["#ff0000"],
      forbidden: ["#ff0000"], // exact same as image color
      tolerance: 10,
    });
    expect(result.has_forbidden_colors).toBe(true);
    expect(result.forbidden_matches.length).toBeGreaterThan(0);
    expect(result.forbidden_matches).toContain("#ff0000");
  });

  test("score is never below 0 even with many mismatches", () => {
    // 5 very different colors, each will be penalised
    const result = analyzeBrandConsistency(
      ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"],
      {
        palette: ["#888888"],
        forbidden: ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"],
        tolerance: 1,
      }
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  test("empty palette returns score 100 (graceful handling)", () => {
    const result = analyzeBrandConsistency(["#ff0000", "#00ff00"], {
      palette: [],
      forbidden: [],
      tolerance: 10,
    });
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.color_matches).toHaveLength(0);
    expect(result.has_forbidden_colors).toBe(false);
  });

  test("tolerance affects matching: tight tolerance flags, loose tolerance passes", () => {
    const dominantColors = ["#3366cc"];
    const brand = {
      palette: ["#3368cf"], // very close to dominant color
      forbidden: [],
    };

    const tight = analyzeBrandConsistency(dominantColors, {
      ...brand,
      tolerance: 0.1,
    });
    const loose = analyzeBrandConsistency(dominantColors, {
      ...brand,
      tolerance: 50,
    });

    expect(tight.score).toBeLessThan(100);
    expect(tight.issues.length).toBeGreaterThan(0);

    expect(loose.score).toBe(100);
    expect(loose.issues).toHaveLength(0);
  });
});
