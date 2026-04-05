import { create } from "zustand";
import type { AIAnalysis } from "./app-store";

export type BatchStep = "idle" | "selecting" | "uploading" | "analyzing" | "reviewed" | "processing" | "completed";

export type BatchImage = {
  file: File;
  uploadId: string | null;
  status: "pending" | "uploading" | "uploaded" | "analyzing" | "analyzed" | "processing" | "processed" | "error";
  analysis: AIAnalysis | null;
  selectedTypeId: string | null;
  qualityScore: number | null;
  error: string | null;
};

type BatchState = {
  batchStep: BatchStep;
  batchId: string | null;
  images: BatchImage[];

  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  updateImage: (index: number, updates: Partial<BatchImage>) => void;
  setBatchStep: (step: BatchStep) => void;
  setBatchId: (id: string) => void;
  reset: () => void;
};

export const useBatchStore = create<BatchState>((set, get) => ({
  batchStep: "idle",
  batchId: null,
  images: [],

  addFiles: (files) => {
    const existing = get().images.map((i) => i.file.name);
    const newImages: BatchImage[] = files
      .filter((f) => !existing.includes(f.name))
      .map((file) => ({
        file,
        uploadId: null,
        status: "pending",
        analysis: null,
        selectedTypeId: null,
        qualityScore: null,
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

  reset: () =>
    set({
      batchStep: "idle",
      batchId: null,
      images: [],
    }),
}));
