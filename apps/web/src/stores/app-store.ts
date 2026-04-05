import { create } from "zustand";

export type AppStep = "idle" | "uploading" | "uploaded" | "cropping" | "processing" | "processed" | "downloaded";

export type ImageMetadata = {
  density: number | null;
  space: string | null;
  channels: number | null;
  depth: string | null;
  hasAlpha: boolean;
  hasProfile: boolean;
  isProgressive: boolean;
  orientation: number | null;
};

export type OriginalImage = {
  url: string;
  width: number;
  height: number;
  format: string;
  sizeKb: number;
  filename: string;
  metadata?: ImageMetadata;
};

export type AIAnalysis = {
  quality: {
    score: number;
    issues: string[];
    blur_detected: boolean;
    low_resolution: boolean;
    poor_contrast: boolean;
  };
  content: {
    type: string;
    primary_subject: string;
    has_text: boolean;
    has_transparency: boolean;
    dominant_colors: string[];
  };
  suggested_type: {
    image_type_id: string | null;
    type_key: string;
    display_name: string;
    confidence: number;
    reasoning: string;
  };
  crop_suggestion: {
    subject_center_x: number;
    subject_center_y: number;
    recommended_crop: { x1: number; y1: number; x2: number; y2: number };
  };
};

export type HistoryEntry = {
  id: string;
  filename: string;
  typeName: string;
  beforeSize: string;
  afterSize: string;
  status: "processed" | "error";
  thumbnailUrl?: string;
};

type AppState = {
  step: AppStep;
  uploadId: string | null;
  originalImage: OriginalImage | null;
  selectedTypeId: string | null;
  processedResult: any | null;
  history: HistoryEntry[];
  error: string | null;

  setStep: (step: AppStep) => void;
  setUpload: (id: string, image: OriginalImage) => void;
  setSelectedTypeId: (id: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  step: "idle",
  uploadId: null,
  originalImage: null,
  selectedTypeId: null,
  processedResult: null,
  history: [],
  error: null,

  setStep: (step) => set({ step, error: null }),
  setUpload: (id, image) => set({ uploadId: id, originalImage: image, step: "uploading" }),
  setSelectedTypeId: (id) => set({ selectedTypeId: id }),
  setError: (error) => set({ error }),
  reset: () => set({
    step: "idle",
    uploadId: null,
    originalImage: null,
    selectedTypeId: null,
    processedResult: null,
    error: null,
  }),
}));
