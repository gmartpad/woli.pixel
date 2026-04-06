import { describe, test, expect, beforeEach } from "bun:test";
import { deduplicateZipFilename } from "./zip-filename";

describe("deduplicateZipFilename", () => {
  let usedNames: Set<string>;

  beforeEach(() => {
    usedNames = new Set<string>();
  });

  test("returns filename unchanged when no collision", () => {
    const result = deduplicateZipFilename("photo_Favicon_128x128.png", usedNames);
    expect(result).toBe("photo_Favicon_128x128.png");
  });

  test("tracks used name in the set", () => {
    deduplicateZipFilename("photo_Favicon_128x128.png", usedNames);
    expect(usedNames.has("photo_Favicon_128x128.png")).toBe(true);
  });

  test("appends _2 on first collision", () => {
    usedNames.add("photo_Favicon_128x128.png");
    const result = deduplicateZipFilename("photo_Favicon_128x128.png", usedNames);
    expect(result).toBe("photo_2_Favicon_128x128.png");
  });

  test("appends _3 when _2 is also taken", () => {
    usedNames.add("photo_Favicon_128x128.png");
    usedNames.add("photo_2_Favicon_128x128.png");
    const result = deduplicateZipFilename("photo_Favicon_128x128.png", usedNames);
    expect(result).toBe("photo_3_Favicon_128x128.png");
  });

  test("handles filename with no type/resolution parts", () => {
    usedNames.add("simple.jpg");
    const result = deduplicateZipFilename("simple.jpg", usedNames);
    expect(result).toBe("simple_2.jpg");
  });

  test("handles multiple sequential duplicates", () => {
    const name = "image_Logo_256x256.png";
    const r1 = deduplicateZipFilename(name, usedNames);
    const r2 = deduplicateZipFilename(name, usedNames);
    const r3 = deduplicateZipFilename(name, usedNames);
    expect(r1).toBe("image_Logo_256x256.png");
    expect(r2).toBe("image_2_Logo_256x256.png");
    expect(r3).toBe("image_3_Logo_256x256.png");
  });

  test("does not collide different base names", () => {
    const r1 = deduplicateZipFilename("alpha_Favicon_128x128.png", usedNames);
    const r2 = deduplicateZipFilename("beta_Favicon_128x128.png", usedNames);
    expect(r1).toBe("alpha_Favicon_128x128.png");
    expect(r2).toBe("beta_Favicon_128x128.png");
  });
});
