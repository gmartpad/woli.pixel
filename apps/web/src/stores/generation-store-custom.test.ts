import { describe, it, expect, beforeEach } from "vitest";
import { useGenerationStore } from "@/stores/generation-store";

describe("generation-store custom resolution", () => {
  beforeEach(() => {
    useGenerationStore.getState().reset();
  });

  it("has customWidth and customHeight fields defaulting to null", () => {
    const state = useGenerationStore.getState();
    expect(state.customWidth).toBeNull();
    expect(state.customHeight).toBeNull();
  });

  it("has customStyle field defaulting to 'auto'", () => {
    expect(useGenerationStore.getState().customStyle).toBe("auto");
  });

  it("has generationMode defaulting to 'preset'", () => {
    expect(useGenerationStore.getState().generationMode).toBe("preset");
  });

  it("has customPresetId defaulting to null", () => {
    expect(useGenerationStore.getState().customPresetId).toBeNull();
  });

  it("setCustomDimensions updates width/height and clears selectedTypeId", () => {
    useGenerationStore.getState().setSelectedTypeId("some-id");
    useGenerationStore.getState().setCustomDimensions(1920, 1080);

    const state = useGenerationStore.getState();
    expect(state.customWidth).toBe(1920);
    expect(state.customHeight).toBe(1080);
    expect(state.selectedTypeId).toBeNull();
    expect(state.customPresetId).toBeNull();
    expect(state.generationMode).toBe("custom");
  });

  it("setSelectedTypeId clears custom dimensions and preset", () => {
    useGenerationStore.getState().setCustomDimensions(1920, 1080);
    useGenerationStore.getState().setCustomPresetId("preset-1");
    useGenerationStore.getState().setSelectedTypeId("some-id");

    const state = useGenerationStore.getState();
    expect(state.customWidth).toBeNull();
    expect(state.customHeight).toBeNull();
    expect(state.customPresetId).toBeNull();
    expect(state.generationMode).toBe("preset");
  });

  it("setCustomPresetId clears selectedTypeId and custom dims", () => {
    useGenerationStore.getState().setSelectedTypeId("some-id");
    useGenerationStore.getState().setCustomDimensions(1920, 1080);
    useGenerationStore.getState().setCustomPresetId("preset-id");

    const state = useGenerationStore.getState();
    expect(state.customPresetId).toBe("preset-id");
    expect(state.selectedTypeId).toBeNull();
    expect(state.customWidth).toBeNull();
    expect(state.customHeight).toBeNull();
    expect(state.generationMode).toBe("custom-preset");
  });

  it("setCustomStyle updates style", () => {
    useGenerationStore.getState().setCustomStyle("photorealistic");
    expect(useGenerationStore.getState().customStyle).toBe("photorealistic");
  });

  it("reset clears all custom fields", () => {
    useGenerationStore.getState().setCustomDimensions(1920, 1080);
    useGenerationStore.getState().setCustomStyle("logo");
    useGenerationStore.getState().reset();

    const state = useGenerationStore.getState();
    expect(state.customWidth).toBeNull();
    expect(state.customHeight).toBeNull();
    expect(state.customStyle).toBe("auto");
    expect(state.customPresetId).toBeNull();
    expect(state.generationMode).toBe("preset");
  });
});
