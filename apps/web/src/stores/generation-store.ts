import { create } from "zustand";

export type GenerationStep = "idle" | "prompting" | "generating" | "processing" | "completed" | "error" | "moderated";
export type QualityTier = "low" | "medium" | "high";
export type GenerationMode = "preset" | "custom" | "custom-preset";
export type CustomStyle = "auto" | "illustration" | "photorealistic" | "logo";

export type GenerationResult = {
  id: string;
  model: string;
  prompt: string;
  enhanced_prompt: string;
  quality_tier: QualityTier;
  cost_usd: number;
  image: {
    width: number;
    height: number;
    format: string;
    size_kb: number;
    download_url: string;
  };
};

export type ModerationData = {
  analysis: string;
  suggestedPrompt: string;
  flaggedReasons: string[];
};

type GenerationState = {
  step: GenerationStep;
  selectedTypeId: string | null;
  prompt: string;
  qualityTier: QualityTier;
  currentJobId: string | null;
  result: GenerationResult | null;
  error: string | null;
  moderation: ModerationData | null;
  generationMode: GenerationMode;
  customWidth: number | null;
  customHeight: number | null;
  customStyle: CustomStyle;
  customPresetId: string | null;

  setPrompt: (prompt: string) => void;
  setSelectedTypeId: (id: string | null) => void;
  setQualityTier: (tier: QualityTier) => void;
  setStep: (step: GenerationStep) => void;
  setCurrentJobId: (id: string | null) => void;
  setResult: (result: GenerationResult) => void;
  setError: (error: string | null) => void;
  setModeration: (data: ModerationData) => void;
  applySuggestedPrompt: () => void;
  setCustomDimensions: (w: number, h: number) => void;
  setCustomStyle: (style: CustomStyle) => void;
  setCustomPresetId: (id: string | null) => void;
  reset: () => void;
};

export const useGenerationStore = create<GenerationState>((set) => ({
  step: "idle",
  selectedTypeId: null,
  prompt: "",
  qualityTier: "medium",
  currentJobId: null,
  result: null,
  error: null,
  moderation: null,
  generationMode: "preset",
  customWidth: null,
  customHeight: null,
  customStyle: "auto",
  customPresetId: null,

  setPrompt: (prompt) => set({ prompt }),
  setSelectedTypeId: (id) => set({
    selectedTypeId: id,
    customWidth: null,
    customHeight: null,
    customPresetId: null,
    generationMode: "preset",
  }),
  setQualityTier: (tier) => set({ qualityTier: tier }),
  setStep: (step) => set({ step, error: step === "error" ? undefined : null }),
  setCurrentJobId: (id) => set({ currentJobId: id }),
  setResult: (result) => set({ result, step: "completed" }),
  setError: (error) => set({ error, step: "error" }),
  setModeration: (data) => set({ moderation: data, step: "moderated", error: null }),
  applySuggestedPrompt: () => set((state) => ({
    prompt: state.moderation?.suggestedPrompt ?? state.prompt,
    moderation: null,
    step: "idle",
  })),
  setCustomDimensions: (w, h) => set({
    customWidth: w,
    customHeight: h,
    selectedTypeId: null,
    customPresetId: null,
    generationMode: "custom",
  }),
  setCustomStyle: (style) => set({ customStyle: style }),
  setCustomPresetId: (id) => set({
    customPresetId: id,
    selectedTypeId: null,
    customWidth: null,
    customHeight: null,
    generationMode: "custom-preset",
  }),
  reset: () => set({
    step: "idle",
    selectedTypeId: null,
    prompt: "",
    qualityTier: "medium",
    currentJobId: null,
    result: null,
    error: null,
    moderation: null,
    generationMode: "preset",
    customWidth: null,
    customHeight: null,
    customStyle: "auto",
    customPresetId: null,
  }),
}));
