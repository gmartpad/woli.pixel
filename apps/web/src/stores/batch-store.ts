import { create } from "zustand";
import type { AIAnalysis } from "./app-store";
import { matchImageToType } from "@/lib/match-image-type";
import type { ImageTypeCandidate } from "@/lib/match-image-type";

export type BatchStep = "idle" | "selecting" | "uploading" | "analyzing" | "reviewed" | "processing" | "completed";

export type ProcessedResult = {
  width: number;
  height: number;
  sizeKb: number;
  format: string;
  adjustments: string[];
  explanation: string | null;
  downloadUrl: string;
};

export type BatchImage = {
  file: File;
  uploadId: string | null;
  originalWidth: number;
  originalHeight: number;
  status: "pending" | "uploading" | "uploaded" | "analyzing" | "analyzed" | "processing" | "processed" | "error";
  analysis: AIAnalysis | null;
  selectedTypeId: string | null;
  qualityScore: number | null;
  qualityTier: "low" | "medium" | "high" | null;
  processedResult: ProcessedResult | null;
  autoMatchScore: number | null;
  cropCoordinates: { x: number; y: number; width: number; height: number } | null;
  error: string | null;
};

type BatchState = {
  batchStep: BatchStep;
  batchId: string | null;
  images: BatchImage[];
  globalTypeId: string | null;
  globalQualityTier: "low" | "medium" | "high";
  assignmentMode: "global" | "per-image" | "auto-select";

  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  updateImage: (index: number, updates: Partial<BatchImage>) => void;
  setBatchStep: (step: BatchStep) => void;
  setBatchId: (id: string) => void;
  setGlobalTypeId: (typeId: string | null) => void;
  setGlobalQualityTier: (tier: "low" | "medium" | "high") => void;
  setAssignmentMode: (mode: "global" | "per-image" | "auto-select") => void;
  setCropForImage: (index: number, crop: { x: number; y: number; width: number; height: number } | null) => void;
  prefillPerImageTypes: () => void;
  prefillByResolution: (types: ImageTypeCandidate[]) => void;
  reset: () => void;
};

export const useBatchStore = create<BatchState>((set, get) => ({
  batchStep: "idle",
  batchId: null,
  images: [],
  globalTypeId: null,
  globalQualityTier: "medium",
  assignmentMode: "global",

  addFiles: (files) => {
    const existing = get().images.map((i) => i.file.name);
    const newImages: BatchImage[] = files
      .filter((f) => !existing.includes(f.name))
      .map((file) => ({
        file,
        uploadId: null,
        originalWidth: 0,
        originalHeight: 0,
        status: "pending",
        analysis: null,
        selectedTypeId: null,
        qualityScore: null,
        qualityTier: null,
        processedResult: null,
        autoMatchScore: null,
        cropCoordinates: null,
        error: null,
      }));
    set((s) => ({ images: [...s.images, ...newImages], batchStep: s.batchStep === "idle" ? "selecting" : s.batchStep }));
  },

  removeFile: (index) => set((s) => ({ images: s.images.filter((_, i) => i !== index) })),

  updateImage: (index, updates) =>
    set((s) => ({
      images: s.images.map((img, i) => (i === index ? { ...img, ...updates } : img)),
    })),

  setBatchStep: (step) => set({ batchStep: step }),
  setBatchId: (id) => set({ batchId: id }),
  setGlobalTypeId: (typeId) => set({ globalTypeId: typeId }),
  setGlobalQualityTier: (tier) => set({ globalQualityTier: tier }),
  setAssignmentMode: (mode) => set({ assignmentMode: mode }),

  setCropForImage: (index, crop) =>
    set((s) => ({
      images: s.images.map((img, i) => (i === index ? { ...img, cropCoordinates: crop } : img)),
    })),

  prefillPerImageTypes: () => {
    const { images, globalTypeId } = get();
    const updated = images.map((img) => {
      if (img.selectedTypeId !== null) return img;
      const aiTypeId = img.analysis?.suggested_type?.image_type_id;
      if (aiTypeId) return { ...img, selectedTypeId: aiTypeId };
      if (globalTypeId) return { ...img, selectedTypeId: globalTypeId };
      return img;
    });
    set({ images: updated });
  },

  prefillByResolution: (types) => {
    const { images } = get();
    const updated = images.map((img) => {
      if (img.selectedTypeId !== null) return img;
      const match = matchImageToType(img.originalWidth, img.originalHeight, types);
      if (!match) return img;
      return { ...img, selectedTypeId: match.typeId, autoMatchScore: match.matchScore };
    });
    set({ images: updated });
  },

  reset: () =>
    set({
      batchStep: "idle",
      batchId: null,
      images: [],
      globalTypeId: null,
      globalQualityTier: "medium",
      assignmentMode: "global",
    }),
}));
