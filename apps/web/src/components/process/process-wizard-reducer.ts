export type ProcessStep = 0 | 1 | 2;

export type ProcessWizardState = {
  step: ProcessStep;
  mode: "single" | "batch";
  uploadId: string | null;
  originalImage: {
    url: string;
    filename: string;
    width: number;
    height: number;
    sizeKb: number;
    format: string;
  } | null;
  analysis: {
    qualityScore: number | null;
    contentType: string | null;
    suggestedTypeId: string | null;
    suggestedTypeName: string | null;
  } | null;
  selectedTypeId: string | null;
  qualityTier: "low" | "medium" | "high";
  result: Record<string, unknown> | null;
  error: string | null;
  isUploading: boolean;
  isProcessing: boolean;
};

export type ProcessWizardAction =
  | { type: "SET_STEP"; step: ProcessStep }
  | { type: "SET_FILE"; uploadId: string; image: ProcessWizardState["originalImage"] }
  | { type: "SET_UPLOADING"; value: boolean }
  | { type: "SET_ANALYSIS"; analysis: ProcessWizardState["analysis"] }
  | { type: "SET_TYPE"; typeId: string }
  | { type: "SET_QUALITY"; tier: "low" | "medium" | "high" }
  | { type: "SET_PROCESSING"; value: boolean }
  | { type: "SET_RESULT"; result: Record<string, unknown> }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_BATCH_MODE" }
  | { type: "RESET" };

export const initialState: ProcessWizardState = {
  step: 0,
  mode: "single",
  uploadId: null,
  originalImage: null,
  analysis: null,
  selectedTypeId: null,
  qualityTier: "medium",
  result: null,
  error: null,
  isUploading: false,
  isProcessing: false,
};

export function processWizardReducer(
  state: ProcessWizardState,
  action: ProcessWizardAction,
): ProcessWizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step, error: null };
    case "SET_FILE":
      return { ...state, uploadId: action.uploadId, originalImage: action.image, isUploading: false };
    case "SET_UPLOADING":
      return { ...state, isUploading: action.value };
    case "SET_ANALYSIS":
      return { ...state, analysis: action.analysis };
    case "SET_TYPE":
      return { ...state, selectedTypeId: action.typeId };
    case "SET_QUALITY":
      return { ...state, qualityTier: action.tier };
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.value };
    case "SET_RESULT":
      return { ...state, result: action.result, isProcessing: false };
    case "SET_ERROR":
      return { ...state, error: action.error, isUploading: false, isProcessing: false };
    case "SET_BATCH_MODE":
      return { ...state, mode: "batch", step: 1 as ProcessStep };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}
