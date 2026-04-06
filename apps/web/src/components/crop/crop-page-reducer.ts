export type CropStep = "idle" | "loaded";
export type AspectPreset = "free" | "1:1" | "4:3" | "3:4" | "16:9" | "9:16";

export type CropPageState = {
  step: CropStep;
  imageSrc: string | null;
  fileName: string | null;
  mimeType: string | null;
  naturalWidth: number;
  naturalHeight: number;
  aspectPreset: AspectPreset;
  zoom: number;
  rotation: number;
  crop: { x: number; y: number };
  croppedAreaPixels: { x: number; y: number; width: number; height: number } | null;
  error: string | null;
};

export type CropPageAction =
  | { type: "SET_IMAGE"; imageSrc: string; fileName: string; mimeType: string; naturalWidth: number; naturalHeight: number }
  | { type: "SET_ASPECT"; preset: AspectPreset }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_ROTATION"; rotation: number }
  | { type: "SET_CROP"; crop: { x: number; y: number } }
  | { type: "SET_CROPPED_AREA"; croppedAreaPixels: { x: number; y: number; width: number; height: number } }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET" };

export const initialCropPageState: CropPageState = {
  step: "idle",
  imageSrc: null,
  fileName: null,
  mimeType: null,
  naturalWidth: 0,
  naturalHeight: 0,
  aspectPreset: "free",
  zoom: 1,
  rotation: 0,
  crop: { x: 0, y: 0 },
  croppedAreaPixels: null,
  error: null,
};

export function cropPageReducer(
  state: CropPageState,
  action: CropPageAction,
): CropPageState {
  switch (action.type) {
    case "SET_IMAGE":
      return {
        ...initialCropPageState,
        step: "loaded",
        imageSrc: action.imageSrc,
        fileName: action.fileName,
        mimeType: action.mimeType,
        naturalWidth: action.naturalWidth,
        naturalHeight: action.naturalHeight,
      };
    case "SET_ASPECT":
      return { ...state, aspectPreset: action.preset };
    case "SET_ZOOM":
      return { ...state, zoom: Math.min(3, Math.max(1, action.zoom)) };
    case "SET_ROTATION":
      return { ...state, rotation: action.rotation };
    case "SET_CROP":
      return { ...state, crop: action.crop };
    case "SET_CROPPED_AREA":
      return { ...state, croppedAreaPixels: action.croppedAreaPixels };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "RESET":
      return { ...initialCropPageState };
    default:
      return state;
  }
}
