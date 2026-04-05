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
});
