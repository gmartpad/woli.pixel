import { describe, test, expect } from "bun:test";
import { customPresets } from "./schema";

describe("customPresets schema", () => {
  test("table has required columns", () => {
    const columns = Object.keys(customPresets);
    expect(columns).toContain("id");
    expect(columns).toContain("userId");
    expect(columns).toContain("name");
    expect(columns).toContain("width");
    expect(columns).toContain("height");
    expect(columns).toContain("style");
    expect(columns).toContain("outputFormat");
    expect(columns).toContain("maxFileSizeKb");
    expect(columns).toContain("requiresTransparency");
    expect(columns).toContain("promptContext");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });
});
