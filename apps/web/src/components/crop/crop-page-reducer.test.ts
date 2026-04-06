import { describe, test, expect } from "vitest";
import {
  cropPageReducer,
  initialCropPageState,
  type CropPageState,
  type CropPageAction,
} from "./crop-page-reducer";

describe("cropPageReducer", () => {
  test("initialState has step idle with null values", () => {
    const s = initialCropPageState;
    expect(s.step).toBe("idle");
    expect(s.imageSrc).toBeNull();
    expect(s.fileName).toBeNull();
    expect(s.mimeType).toBeNull();
    expect(s.naturalWidth).toBe(0);
    expect(s.naturalHeight).toBe(0);
    expect(s.aspectPreset).toBe("free");
    expect(s.zoom).toBe(1);
    expect(s.rotation).toBe(0);
    expect(s.crop).toEqual({ x: 0, y: 0 });
    expect(s.croppedAreaPixels).toBeNull();
    expect(s.error).toBeNull();
  });

  describe("SET_IMAGE", () => {
    test("transitions from idle to loaded with image data", () => {
      const action: CropPageAction = {
        type: "SET_IMAGE",
        imageSrc: "blob:http://localhost/abc",
        fileName: "photo.png",
        mimeType: "image/png",
        naturalWidth: 1920,
        naturalHeight: 1080,
      };

      const next = cropPageReducer(initialCropPageState, action);

      expect(next.step).toBe("loaded");
      expect(next.imageSrc).toBe("blob:http://localhost/abc");
      expect(next.fileName).toBe("photo.png");
      expect(next.mimeType).toBe("image/png");
      expect(next.naturalWidth).toBe(1920);
      expect(next.naturalHeight).toBe(1080);
      expect(next.error).toBeNull();
      expect(next.zoom).toBe(1);
      expect(next.rotation).toBe(0);
    });

    test("clears previous error on SET_IMAGE", () => {
      const stateWithError: CropPageState = {
        ...initialCropPageState,
        error: "Something went wrong",
      };

      const next = cropPageReducer(stateWithError, {
        type: "SET_IMAGE",
        imageSrc: "blob:x",
        fileName: "a.jpg",
        mimeType: "image/jpeg",
        naturalWidth: 800,
        naturalHeight: 600,
      });

      expect(next.error).toBeNull();
      expect(next.step).toBe("loaded");
    });
  });

  describe("SET_ASPECT", () => {
    test("updates aspectPreset", () => {
      const next = cropPageReducer(initialCropPageState, {
        type: "SET_ASPECT",
        preset: "1:1",
      });
      expect(next.aspectPreset).toBe("1:1");
    });

    test("accepts all valid presets", () => {
      const presets = ["free", "1:1", "4:3", "3:4", "16:9", "9:16"] as const;
      for (const preset of presets) {
        const next = cropPageReducer(initialCropPageState, {
          type: "SET_ASPECT",
          preset,
        });
        expect(next.aspectPreset).toBe(preset);
      }
    });
  });

  describe("SET_ZOOM", () => {
    test("updates zoom value", () => {
      const next = cropPageReducer(initialCropPageState, {
        type: "SET_ZOOM",
        zoom: 2.5,
      });
      expect(next.zoom).toBe(2.5);
    });

    test("clamps zoom to min 1", () => {
      const next = cropPageReducer(initialCropPageState, {
        type: "SET_ZOOM",
        zoom: 0.5,
      });
      expect(next.zoom).toBe(1);
    });

    test("clamps zoom to max 3", () => {
      const next = cropPageReducer(initialCropPageState, {
        type: "SET_ZOOM",
        zoom: 5,
      });
      expect(next.zoom).toBe(3);
    });
  });

  describe("SET_ROTATION", () => {
    test("updates rotation value", () => {
      const next = cropPageReducer(initialCropPageState, {
        type: "SET_ROTATION",
        rotation: 90,
      });
      expect(next.rotation).toBe(90);
    });
  });

  describe("SET_CROP", () => {
    test("updates crop position", () => {
      const next = cropPageReducer(initialCropPageState, {
        type: "SET_CROP",
        crop: { x: 100, y: 200 },
      });
      expect(next.crop).toEqual({ x: 100, y: 200 });
    });
  });

  describe("SET_CROPPED_AREA", () => {
    test("updates croppedAreaPixels", () => {
      const area = { x: 10, y: 20, width: 300, height: 400 };
      const next = cropPageReducer(initialCropPageState, {
        type: "SET_CROPPED_AREA",
        croppedAreaPixels: area,
      });
      expect(next.croppedAreaPixels).toEqual(area);
    });
  });

  describe("SET_ERROR", () => {
    test("sets error message", () => {
      const next = cropPageReducer(initialCropPageState, {
        type: "SET_ERROR",
        error: "Arquivo muito grande",
      });
      expect(next.error).toBe("Arquivo muito grande");
    });
  });

  describe("RESET", () => {
    test("returns to initial state", () => {
      const loaded: CropPageState = {
        step: "loaded",
        imageSrc: "blob:abc",
        fileName: "test.png",
        mimeType: "image/png",
        naturalWidth: 1920,
        naturalHeight: 1080,
        aspectPreset: "16:9",
        zoom: 2,
        rotation: 45,
        crop: { x: 50, y: 50 },
        croppedAreaPixels: { x: 0, y: 0, width: 100, height: 100 },
        error: null,
      };

      const next = cropPageReducer(loaded, { type: "RESET" });
      expect(next).toEqual(initialCropPageState);
    });
  });

  test("returns current state for unknown action", () => {
    const state = { ...initialCropPageState, zoom: 2 };
    // @ts-expect-error — testing unknown action
    const next = cropPageReducer(state, { type: "UNKNOWN" });
    expect(next).toBe(state);
  });
});
