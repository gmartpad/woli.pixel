import { create } from "zustand";

export type QualityGateConfig = {
  id: string;
  name: string;
  isActive: boolean;
  minQualityScore: number;
  maxFileSizeKb: number | null;
  requireNoBlur: boolean;
  requireNoLowResolution: boolean;
  requireMinWidth: number | null;
  requireMinHeight: number | null;
  allowedContentTypes: string[] | null;
  blockedContentTypes: string[] | null;
  brandProfileId: string | null;
  webhookSecret: string | null;
};

export type GateResult = {
  id: string;
  verdict: "pass" | "fail" | "warn";
  qualityScore: number;
  failures: string[];
  warnings: string[];
  source: string;
  sourceReference: string | null;
  checkedAt: string;
};

export type GateEvaluation = {
  verdict: "pass" | "fail" | "warn";
  quality_score: number;
  failures: string[];
  warnings: string[];
  details: Record<string, any>;
};

type GateState = {
  configs: QualityGateConfig[];
  selectedConfigId: string | null;
  results: GateResult[];

  setConfigs: (configs: QualityGateConfig[]) => void;
  setSelectedConfig: (id: string | null) => void;
  setResults: (results: GateResult[]) => void;
  reset: () => void;
};

export const useGateStore = create<GateState>((set) => ({
  configs: [],
  selectedConfigId: null,
  results: [],

  setConfigs: (configs) => set({ configs }),
  setSelectedConfig: (id) => set({ selectedConfigId: id }),
  setResults: (results) => set({ results }),
  reset: () => set({ configs: [], selectedConfigId: null, results: [] }),
}));
