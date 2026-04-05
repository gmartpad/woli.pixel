import { create } from "zustand";

export type AuditStep = "idle" | "setup" | "uploading" | "scanning" | "report";

export type AuditJob = {
  id: string;
  name: string;
  status: string;
  totalImages: number;
  scannedImages: number;
  passedImages: number;
  failedImages: number;
  errorImages: number;
  avgQualityScore: number | null;
  passThreshold: number;
};

export type AuditItem = {
  id: string;
  originalFilename: string;
  qualityScore: number | null;
  contentType: string | null;
  qualityIssues: string[];
  suggestedTypeKey: string | null;
  status: string;
};

export type AuditReport = {
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    avg_score: number;
    median_score: number;
  };
  score_distribution: Record<string, number>;
  top_issues: Array<{ issue: string; count: number; percentage: number }>;
  content_type_distribution: Record<string, number>;
  format_distribution: Record<string, number>;
  size_stats: { avg_kb: number; total_mb: number; oversized_count: number };
  worst_offenders: Array<{ filename: string; score: number; issues: string[] }>;
};

type AuditState = {
  step: AuditStep;
  currentJob: AuditJob | null;
  items: AuditItem[];
  report: AuditReport | null;

  setStep: (step: AuditStep) => void;
  setCurrentJob: (job: AuditJob) => void;
  setItems: (items: AuditItem[]) => void;
  setReport: (report: AuditReport) => void;
  reset: () => void;
};

export const useAuditStore = create<AuditState>((set) => ({
  step: "idle",
  currentJob: null,
  items: [],
  report: null,

  setStep: (step) => set({ step }),
  setCurrentJob: (job) => set({ currentJob: job }),
  setItems: (items) => set({ items }),
  setReport: (report) => set({ report }),
  reset: () => set({ step: "idle", currentJob: null, items: [], report: null }),
}));
