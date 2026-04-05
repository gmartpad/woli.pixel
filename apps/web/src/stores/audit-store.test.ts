import { describe, it, expect, beforeEach } from "vitest";
import { useAuditStore, type AuditJob, type AuditReport } from "./audit-store";

const MOCK_JOB: AuditJob = {
  id: "audit-1",
  name: "Test Audit",
  status: "created",
  totalImages: 10,
  scannedImages: 0,
  passedImages: 0,
  failedImages: 0,
  errorImages: 0,
  avgQualityScore: null,
  passThreshold: 7,
};

const MOCK_REPORT: AuditReport = {
  summary: { total: 10, passed: 7, failed: 2, errors: 1, avg_score: 7.5, median_score: 8 },
  score_distribution: { "1-2": 0, "3-4": 1, "5-6": 1, "7-8": 5, "9-10": 3 },
  top_issues: [{ issue: "Baixa resolução", count: 3, percentage: 30 }],
  content_type_distribution: { photo: 6, logo: 3, icon: 1 },
  format_distribution: { png: 4, jpeg: 6 },
  size_stats: { avg_kb: 350, total_mb: 3.5, oversized_count: 1 },
  worst_offenders: [{ filename: "bad.jpg", score: 3, issues: ["Blur"] }],
};

describe("useAuditStore", () => {
  beforeEach(() => {
    useAuditStore.getState().reset();
  });

  it("initial state is idle", () => {
    const state = useAuditStore.getState();
    expect(state.step).toBe("idle");
    expect(state.currentJob).toBeNull();
    expect(state.items).toEqual([]);
    expect(state.report).toBeNull();
  });

  it("setStep updates step", () => {
    useAuditStore.getState().setStep("scanning");
    expect(useAuditStore.getState().step).toBe("scanning");
  });

  it("setCurrentJob stores job", () => {
    useAuditStore.getState().setCurrentJob(MOCK_JOB);
    expect(useAuditStore.getState().currentJob).toEqual(MOCK_JOB);
  });

  it("setItems stores items array", () => {
    const items = [
      { id: "i1", originalFilename: "a.png", qualityScore: 8, contentType: "photo", qualityIssues: [], suggestedTypeKey: "conteudo_imagem", status: "scanned" },
    ];
    useAuditStore.getState().setItems(items);
    expect(useAuditStore.getState().items).toHaveLength(1);
  });

  it("setReport stores report", () => {
    useAuditStore.getState().setReport(MOCK_REPORT);
    expect(useAuditStore.getState().report?.summary.total).toBe(10);
  });

  it("reset clears all state", () => {
    useAuditStore.getState().setCurrentJob(MOCK_JOB);
    useAuditStore.getState().setStep("report");
    useAuditStore.getState().setReport(MOCK_REPORT);
    useAuditStore.getState().reset();
    const state = useAuditStore.getState();
    expect(state.step).toBe("idle");
    expect(state.currentJob).toBeNull();
    expect(state.report).toBeNull();
  });
});
