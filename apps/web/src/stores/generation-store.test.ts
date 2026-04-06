import { describe, it, expect, beforeEach } from "vitest";
import { useGenerationStore, type GenerationResult } from "./generation-store";

const MOCK_RESULT: GenerationResult = {
  id: "gen-1",
  model: "recraft_v3",
  prompt: "blue logo",
  enhanced_prompt: "Professional logo mark. blue logo",
  quality_tier: "medium",
  cost_usd: 0.05,
  image: {
    width: 128,
    height: 128,
    format: "png",
    size_kb: 45,
    download_url: "/api/v1/generate/gen-1/download",
  },
};

describe("useGenerationStore", () => {
  beforeEach(() => {
    useGenerationStore.getState().reset();
  });

  it("initial state is idle with defaults", () => {
    const s = useGenerationStore.getState();
    expect(s.step).toBe("idle");
    expect(s.selectedTypeId).toBeNull();
    expect(s.prompt).toBe("");
    expect(s.qualityTier).toBe("medium");
    expect(s.result).toBeNull();
    expect(s.error).toBeNull();
  });

  it("setPrompt updates prompt", () => {
    useGenerationStore.getState().setPrompt("A mountain landscape");
    expect(useGenerationStore.getState().prompt).toBe("A mountain landscape");
  });

  it("setSelectedTypeId updates type", () => {
    useGenerationStore.getState().setSelectedTypeId("type-1");
    expect(useGenerationStore.getState().selectedTypeId).toBe("type-1");
  });

  it("setQualityTier updates tier", () => {
    useGenerationStore.getState().setQualityTier("high");
    expect(useGenerationStore.getState().qualityTier).toBe("high");
  });

  it("setStep transitions step", () => {
    useGenerationStore.getState().setStep("generating");
    expect(useGenerationStore.getState().step).toBe("generating");
  });

  it("setResult stores result and transitions to completed", () => {
    useGenerationStore.getState().setResult(MOCK_RESULT);
    const s = useGenerationStore.getState();
    expect(s.result).toEqual(MOCK_RESULT);
    expect(s.step).toBe("completed");
  });

  it("setError stores error and transitions to error step", () => {
    useGenerationStore.getState().setError("API failed");
    const s = useGenerationStore.getState();
    expect(s.error).toBe("API failed");
    expect(s.step).toBe("error");
  });

  it("reset clears all state", () => {
    useGenerationStore.getState().setPrompt("test");
    useGenerationStore.getState().setSelectedTypeId("t-1");
    useGenerationStore.getState().setQualityTier("high");
    useGenerationStore.getState().setResult(MOCK_RESULT);
    useGenerationStore.getState().reset();
    const s = useGenerationStore.getState();
    expect(s.step).toBe("idle");
    expect(s.prompt).toBe("");
    expect(s.qualityTier).toBe("medium");
    expect(s.result).toBeNull();
  });

  it("setModeration stores moderation data and transitions to moderated step", () => {
    useGenerationStore.getState().setModeration({
      analysis: "O prompt menciona Darth Vader, protegido por direitos autorais.",
      suggestedPrompt: "Um cavaleiro espacial com armadura escura",
      flaggedReasons: ["Content Policy Violation"],
    });
    const s = useGenerationStore.getState();
    expect(s.step).toBe("moderated");
    expect(s.moderation).not.toBeNull();
    expect(s.moderation!.analysis).toContain("Darth Vader");
    expect(s.moderation!.suggestedPrompt).toContain("cavaleiro espacial");
    expect(s.moderation!.flaggedReasons).toEqual(["Content Policy Violation"]);
  });

  it("applySuggestedPrompt fills prompt from moderation and resets to idle", () => {
    useGenerationStore.getState().setModeration({
      analysis: "Motivo",
      suggestedPrompt: "Um cavaleiro espacial com armadura escura",
      flaggedReasons: ["Content Policy Violation"],
    });
    useGenerationStore.getState().applySuggestedPrompt();
    const s = useGenerationStore.getState();
    expect(s.prompt).toBe("Um cavaleiro espacial com armadura escura");
    expect(s.step).toBe("idle");
    expect(s.moderation).toBeNull();
  });

  it("reset clears moderation state", () => {
    useGenerationStore.getState().setModeration({
      analysis: "test",
      suggestedPrompt: "alt",
      flaggedReasons: ["test"],
    });
    useGenerationStore.getState().reset();
    const s = useGenerationStore.getState();
    expect(s.moderation).toBeNull();
    expect(s.step).toBe("idle");
  });
});
