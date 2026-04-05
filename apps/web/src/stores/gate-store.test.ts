import { describe, it, expect, beforeEach } from "vitest";
import { useGateStore, type QualityGateConfig } from "./gate-store";

const MOCK_CONFIG: QualityGateConfig = {
  id: "gate-1",
  name: "Production Gate",
  isActive: true,
  minQualityScore: 6,
  maxFileSizeKb: 500,
  requireNoBlur: true,
  requireNoLowResolution: true,
  requireMinWidth: null,
  requireMinHeight: null,
  allowedContentTypes: null,
  blockedContentTypes: null,
  brandProfileId: null,
  webhookSecret: null,
};

describe("useGateStore", () => {
  beforeEach(() => {
    useGateStore.getState().reset();
  });

  it("initial state has no selectedConfigId", () => {
    expect(useGateStore.getState().selectedConfigId).toBeNull();
    expect(useGateStore.getState().configs).toEqual([]);
    expect(useGateStore.getState().results).toEqual([]);
  });

  it("setConfigs stores configs array", () => {
    useGateStore.getState().setConfigs([MOCK_CONFIG]);
    expect(useGateStore.getState().configs).toHaveLength(1);
    expect(useGateStore.getState().configs[0].name).toBe("Production Gate");
  });

  it("setSelectedConfig updates selectedConfigId", () => {
    useGateStore.getState().setSelectedConfig("gate-1");
    expect(useGateStore.getState().selectedConfigId).toBe("gate-1");
  });

  it("deselecting config clears ID", () => {
    useGateStore.getState().setSelectedConfig("gate-1");
    useGateStore.getState().setSelectedConfig(null);
    expect(useGateStore.getState().selectedConfigId).toBeNull();
  });

  it("setResults stores results", () => {
    useGateStore.getState().setResults([
      { id: "r1", verdict: "pass", qualityScore: 8, failures: [], warnings: [], source: "api", sourceReference: null, checkedAt: "2026-04-04" },
    ]);
    expect(useGateStore.getState().results).toHaveLength(1);
  });

  it("reset clears all state", () => {
    useGateStore.getState().setConfigs([MOCK_CONFIG]);
    useGateStore.getState().setSelectedConfig("gate-1");
    useGateStore.getState().reset();
    expect(useGateStore.getState().configs).toEqual([]);
    expect(useGateStore.getState().selectedConfigId).toBeNull();
  });
});
