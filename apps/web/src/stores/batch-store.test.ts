import { describe, it, expect, beforeEach } from "vitest";
import { useBatchStore } from "./batch-store";

function createMockFile(name: string): File {
  return new File(["content"], name, { type: "image/png" });
}

describe("useBatchStore", () => {
  beforeEach(() => {
    useBatchStore.getState().reset();
  });

  it("initial state is idle with no images", () => {
    const state = useBatchStore.getState();
    expect(state.batchStep).toBe("idle");
    expect(state.batchId).toBeNull();
    expect(state.images).toEqual([]);
  });

  it("addFiles adds files to images array", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png"), createMockFile("b.png")]);
    expect(useBatchStore.getState().images).toHaveLength(2);
    expect(useBatchStore.getState().images[0].file.name).toBe("a.png");
    expect(useBatchStore.getState().images[0].status).toBe("pending");
  });

  it("addFiles deduplicates by filename", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().addFiles([createMockFile("a.png"), createMockFile("b.png")]);
    expect(useBatchStore.getState().images).toHaveLength(2);
  });

  it("addFiles transitions from idle to selecting", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    expect(useBatchStore.getState().batchStep).toBe("selecting");
  });

  it("removeFile removes by index", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png"), createMockFile("b.png"), createMockFile("c.png")]);
    useBatchStore.getState().removeFile(1);
    const names = useBatchStore.getState().images.map((i) => i.file.name);
    expect(names).toEqual(["a.png", "c.png"]);
  });

  it("updateImage merges partial updates", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().updateImage(0, { status: "analyzing", qualityScore: 8 });
    const img = useBatchStore.getState().images[0];
    expect(img.status).toBe("analyzing");
    expect(img.qualityScore).toBe(8);
    expect(img.file.name).toBe("a.png"); // other fields preserved
  });

  it("setBatchStep transitions step", () => {
    useBatchStore.getState().setBatchStep("uploading");
    expect(useBatchStore.getState().batchStep).toBe("uploading");
  });

  it("setBatchId stores batch ID", () => {
    useBatchStore.getState().setBatchId("batch-123");
    expect(useBatchStore.getState().batchId).toBe("batch-123");
  });

  it("reset returns to initial state", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().setBatchId("b-1");
    useBatchStore.getState().setBatchStep("analyzing");
    useBatchStore.getState().reset();
    const state = useBatchStore.getState();
    expect(state.batchStep).toBe("idle");
    expect(state.batchId).toBeNull();
    expect(state.images).toEqual([]);
  });

  // --- New fields: globalTypeId, globalQualityTier, per-image qualityTier + processedResult ---

  it("initial globalTypeId is null", () => {
    expect(useBatchStore.getState().globalTypeId).toBeNull();
  });

  it("initial globalQualityTier is 'medium'", () => {
    expect(useBatchStore.getState().globalQualityTier).toBe("medium");
  });

  it("setGlobalTypeId sets the global type", () => {
    useBatchStore.getState().setGlobalTypeId("type-1");
    expect(useBatchStore.getState().globalTypeId).toBe("type-1");
  });

  it("setGlobalTypeId can be set to null", () => {
    useBatchStore.getState().setGlobalTypeId("type-1");
    useBatchStore.getState().setGlobalTypeId(null);
    expect(useBatchStore.getState().globalTypeId).toBeNull();
  });

  it("setGlobalQualityTier updates the global quality", () => {
    useBatchStore.getState().setGlobalQualityTier("high");
    expect(useBatchStore.getState().globalQualityTier).toBe("high");
  });

  it("addFiles initializes new images with qualityTier null and processedResult null", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    const img = useBatchStore.getState().images[0];
    expect(img.qualityTier).toBeNull();
    expect(img.processedResult).toBeNull();
  });

  it("updateImage can set per-image qualityTier", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().updateImage(0, { qualityTier: "high" });
    expect(useBatchStore.getState().images[0].qualityTier).toBe("high");
  });

  it("updateImage can set processedResult", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    const result = {
      width: 800,
      height: 600,
      sizeKb: 120,
      format: "jpeg",
      adjustments: ["resized"],
      explanation: "Resized",
      downloadUrl: "/download/1",
    };
    useBatchStore.getState().updateImage(0, { processedResult: result });
    expect(useBatchStore.getState().images[0].processedResult).toEqual(result);
  });

  it("reset clears globalTypeId and globalQualityTier", () => {
    useBatchStore.getState().setGlobalTypeId("type-1");
    useBatchStore.getState().setGlobalQualityTier("high");
    useBatchStore.getState().reset();
    expect(useBatchStore.getState().globalTypeId).toBeNull();
    expect(useBatchStore.getState().globalQualityTier).toBe("medium");
  });

  // --- assignmentMode: global vs per-image ---

  it("initial assignmentMode is 'global'", () => {
    expect(useBatchStore.getState().assignmentMode).toBe("global");
  });

  it("setAssignmentMode sets mode to 'per-image'", () => {
    useBatchStore.getState().setAssignmentMode("per-image");
    expect(useBatchStore.getState().assignmentMode).toBe("per-image");
  });

  it("setAssignmentMode sets mode back to 'global'", () => {
    useBatchStore.getState().setAssignmentMode("per-image");
    useBatchStore.getState().setAssignmentMode("global");
    expect(useBatchStore.getState().assignmentMode).toBe("global");
  });

  it("reset restores assignmentMode to 'global'", () => {
    useBatchStore.getState().setAssignmentMode("per-image");
    useBatchStore.getState().reset();
    expect(useBatchStore.getState().assignmentMode).toBe("global");
  });

  it("prefillPerImageTypes uses AI suggestion when available", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().updateImage(0, {
      status: "analyzed",
      analysis: {
        quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
        content: { type: "photo", primary_subject: "Test", has_text: false, has_transparency: false, dominant_colors: [] },
        suggested_type: { image_type_id: "type-ai", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
        crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
      },
    });
    useBatchStore.getState().setGlobalTypeId("type-global");
    useBatchStore.getState().prefillPerImageTypes();
    expect(useBatchStore.getState().images[0].selectedTypeId).toBe("type-ai");
  });

  it("prefillPerImageTypes uses globalTypeId when no AI suggestion", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().updateImage(0, { status: "analyzed", analysis: null });
    useBatchStore.getState().setGlobalTypeId("type-global");
    useBatchStore.getState().prefillPerImageTypes();
    expect(useBatchStore.getState().images[0].selectedTypeId).toBe("type-global");
  });

  it("prefillPerImageTypes leaves null when no suggestion and no global", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().updateImage(0, { status: "analyzed", analysis: null });
    useBatchStore.getState().prefillPerImageTypes();
    expect(useBatchStore.getState().images[0].selectedTypeId).toBeNull();
  });

  it("prefillPerImageTypes does not overwrite existing selectedTypeId", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().updateImage(0, {
      status: "analyzed",
      selectedTypeId: "type-manual",
      analysis: {
        quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
        content: { type: "photo", primary_subject: "Test", has_text: false, has_transparency: false, dominant_colors: [] },
        suggested_type: { image_type_id: "type-ai", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
        crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
      },
    });
    useBatchStore.getState().setGlobalTypeId("type-global");
    useBatchStore.getState().prefillPerImageTypes();
    expect(useBatchStore.getState().images[0].selectedTypeId).toBe("type-manual");
  });

  // ── cropCoordinates support ──────

  it("addFiles initializes cropCoordinates as null", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    expect(useBatchStore.getState().images[0].cropCoordinates).toBeNull();
  });

  it("setCropForImage stores crop coordinates for a specific image", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png"), createMockFile("b.png")]);
    const crop = { x: 10, y: 20, width: 100, height: 80 };
    useBatchStore.getState().setCropForImage(1, crop);
    expect(useBatchStore.getState().images[0].cropCoordinates).toBeNull();
    expect(useBatchStore.getState().images[1].cropCoordinates).toEqual(crop);
  });

  it("setCropForImage can clear crop by setting null", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().setCropForImage(0, { x: 10, y: 20, width: 100, height: 80 });
    expect(useBatchStore.getState().images[0].cropCoordinates).not.toBeNull();
    useBatchStore.getState().setCropForImage(0, null);
    expect(useBatchStore.getState().images[0].cropCoordinates).toBeNull();
  });

  it("reset clears all cropCoordinates", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().setCropForImage(0, { x: 10, y: 20, width: 100, height: 80 });
    useBatchStore.getState().reset();
    expect(useBatchStore.getState().images).toEqual([]);
  });

  // ── auto-select mode + prefillByResolution ──────

  it("setAssignmentMode accepts 'auto-select'", () => {
    useBatchStore.getState().setAssignmentMode("auto-select");
    expect(useBatchStore.getState().assignmentMode).toBe("auto-select");
  });

  it("addFiles initializes autoMatchScore as null", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    expect(useBatchStore.getState().images[0].autoMatchScore).toBeNull();
  });

  it("prefillByResolution assigns selectedTypeId and autoMatchScore per image", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().updateImage(0, { originalWidth: 1920, originalHeight: 1080 });

    const types = [
      { id: "t-16x9", width: 1920, height: 1080 },
      { id: "t-square", width: 300, height: 300 },
    ];
    useBatchStore.getState().prefillByResolution(types);

    const img = useBatchStore.getState().images[0];
    expect(img.selectedTypeId).toBe("t-16x9");
    expect(img.autoMatchScore).toBeGreaterThan(0.9);
  });

  it("prefillByResolution does NOT overwrite existing selectedTypeId", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    useBatchStore.getState().updateImage(0, {
      originalWidth: 1920,
      originalHeight: 1080,
      selectedTypeId: "manual-choice",
    });

    const types = [{ id: "t-16x9", width: 1920, height: 1080 }];
    useBatchStore.getState().prefillByResolution(types);

    expect(useBatchStore.getState().images[0].selectedTypeId).toBe("manual-choice");
  });

  it("prefillByResolution handles images with 0 dimensions gracefully", () => {
    useBatchStore.getState().addFiles([createMockFile("a.png")]);
    // originalWidth/Height default to 0
    const types = [{ id: "t1", width: 1920, height: 1080 }];
    useBatchStore.getState().prefillByResolution(types);

    const img = useBatchStore.getState().images[0];
    expect(img.selectedTypeId).toBeNull();
    expect(img.autoMatchScore).toBeNull();
  });

  it("reset restores assignmentMode from 'auto-select' to 'global'", () => {
    useBatchStore.getState().setAssignmentMode("auto-select");
    useBatchStore.getState().reset();
    expect(useBatchStore.getState().assignmentMode).toBe("global");
  });
});
