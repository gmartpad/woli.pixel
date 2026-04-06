import { describe, it, expect } from "vitest";
import { formatSize } from "./format";

describe("formatSize", () => {
  it("returns KB for values under 1024", () => {
    expect(formatSize(500)).toBe("500 KB");
  });

  it("returns MB with one decimal for values >= 1024", () => {
    expect(formatSize(1024)).toBe("1.0 MB");
  });

  it("rounds MB to one decimal place", () => {
    expect(formatSize(1536)).toBe("1.5 MB");
  });

  it("handles zero", () => {
    expect(formatSize(0)).toBe("0 KB");
  });

  it("handles fractional KB boundary", () => {
    expect(formatSize(2048)).toBe("2.0 MB");
  });
});
