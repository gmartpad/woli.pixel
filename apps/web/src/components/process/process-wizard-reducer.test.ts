// process-wizard-reducer.test.ts
import { describe, it, expect } from "vitest";
import {
  processWizardReducer,
  initialState,
  type ProcessWizardState,
} from "./process-wizard-reducer";

describe("processWizardReducer", () => {
  it("has correct initial state", () => {
    expect(initialState.step).toBe(0);
    expect(initialState.uploadId).toBeNull();
    expect(initialState.originalImage).toBeNull();
    expect(initialState.analysis).toBeNull();
    expect(initialState.selectedTypeId).toBeNull();
    expect(initialState.qualityTier).toBe("medium");
    expect(initialState.result).toBeNull();
    expect(initialState.error).toBeNull();
    expect(initialState.isUploading).toBe(false);
    expect(initialState.isProcessing).toBe(false);
  });

  it("SET_STEP changes step and clears error", () => {
    const state: ProcessWizardState = { ...initialState, step: 0, error: "some error" };
    const result = processWizardReducer(state, { type: "SET_STEP", step: 1 });
    expect(result.step).toBe(1);
    expect(result.error).toBeNull();
  });

  it("SET_FILE stores upload data and clears uploading flag", () => {
    const image = { url: "blob://test", filename: "photo.jpg", width: 800, height: 600, sizeKb: 150, format: "jpeg" };
    const state: ProcessWizardState = { ...initialState, isUploading: true };
    const result = processWizardReducer(state, { type: "SET_FILE", uploadId: "u1", image });
    expect(result.uploadId).toBe("u1");
    expect(result.originalImage).toEqual(image);
    expect(result.isUploading).toBe(false);
  });

  it("SET_UPLOADING sets the uploading flag", () => {
    const result = processWizardReducer(initialState, { type: "SET_UPLOADING", value: true });
    expect(result.isUploading).toBe(true);
  });

  it("SET_ANALYSIS stores analysis data", () => {
    const analysis = { qualityScore: 85, contentType: "photo", suggestedTypeId: "t1", suggestedTypeName: "Favicon" };
    const result = processWizardReducer(initialState, { type: "SET_ANALYSIS", analysis });
    expect(result.analysis).toEqual(analysis);
  });

  it("SET_TYPE stores selected type ID", () => {
    const result = processWizardReducer(initialState, { type: "SET_TYPE", typeId: "type-1" });
    expect(result.selectedTypeId).toBe("type-1");
  });

  it("SET_QUALITY stores quality tier", () => {
    const result = processWizardReducer(initialState, { type: "SET_QUALITY", tier: "high" });
    expect(result.qualityTier).toBe("high");
  });

  it("SET_PROCESSING sets the processing flag", () => {
    const result = processWizardReducer(initialState, { type: "SET_PROCESSING", value: true });
    expect(result.isProcessing).toBe(true);
  });

  it("SET_RESULT stores result and clears processing flag", () => {
    const state: ProcessWizardState = { ...initialState, isProcessing: true };
    const resultData = { width: 300, height: 300 };
    const result = processWizardReducer(state, { type: "SET_RESULT", result: resultData });
    expect(result.result).toEqual(resultData);
    expect(result.isProcessing).toBe(false);
  });

  it("SET_ERROR stores error and clears loading flags", () => {
    const state: ProcessWizardState = { ...initialState, isUploading: true, isProcessing: true };
    const result = processWizardReducer(state, { type: "SET_ERROR", error: "Failed" });
    expect(result.error).toBe("Failed");
    expect(result.isUploading).toBe(false);
    expect(result.isProcessing).toBe(false);
  });

  it("RESET returns to initial state", () => {
    const state: ProcessWizardState = {
      ...initialState,
      step: 2,
      uploadId: "u1",
      selectedTypeId: "t1",
      error: "err",
    };
    const result = processWizardReducer(state, { type: "RESET" });
    expect(result).toEqual(initialState);
  });

  it("initial state has mode set to single", () => {
    expect(initialState.mode).toBe("single");
  });

  it("SET_BATCH_MODE sets mode to batch and step to 1", () => {
    const result = processWizardReducer(initialState, { type: "SET_BATCH_MODE" });
    expect(result.mode).toBe("batch");
    expect(result.step).toBe(1);
  });

  it("RESET restores mode to single after batch mode", () => {
    const state: ProcessWizardState = {
      ...initialState,
      mode: "batch",
      step: 2,
    };
    const result = processWizardReducer(state, { type: "RESET" });
    expect(result.mode).toBe("single");
  });
});
