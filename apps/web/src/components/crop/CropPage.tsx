import { useReducer, useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cropPageReducer, initialCropPageState } from "./crop-page-reducer";
import { CropUploadZone } from "./CropUploadZone";
import { CropToolbar } from "./CropToolbar";
import { getCroppedImage } from "@/lib/image-crop";
import { saveCroppedImage } from "@/lib/api";
import type { AspectPreset } from "./crop-page-reducer";

const ASPECT_MAP: Record<AspectPreset, number | undefined> = {
  free: undefined,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
};

export function CropPage() {
  const [state, dispatch] = useReducer(cropPageReducer, initialCropPageState);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const originalFileRef = useRef<File | null>(null);

  const handleImageLoaded = useCallback(
    (data: { imageSrc: string; fileName: string; mimeType: string; naturalWidth: number; naturalHeight: number }) => {
      // Keep the original file for later upload
      fetch(data.imageSrc)
        .then((r) => r.blob())
        .then((blob) => {
          originalFileRef.current = new File([blob], data.fileName, { type: data.mimeType });
        });
      dispatch({
        type: "SET_IMAGE",
        imageSrc: data.imageSrc,
        fileName: data.fileName,
        mimeType: data.mimeType,
        naturalWidth: data.naturalWidth,
        naturalHeight: data.naturalHeight,
      });
    },
    [],
  );

  const handleCropComplete = useCallback(
    (_croppedArea: unknown, croppedAreaPixels: { x: number; y: number; width: number; height: number }) => {
      dispatch({ type: "SET_CROPPED_AREA", croppedAreaPixels });
    },
    [],
  );

  const handleSaveAndDownload = useCallback(async () => {
    if (!state.imageSrc || !state.croppedAreaPixels || !state.fileName || !state.mimeType) return;

    setIsSaving(true);
    try {
      // Generate cropped file from canvas
      const croppedFile = await getCroppedImage(
        state.imageSrc,
        state.croppedAreaPixels,
        `cropped-${state.fileName}`,
        state.mimeType,
      );

      // Get original file
      const original = originalFileRef.current;
      if (!original) throw new Error("Arquivo original não encontrado");

      // Upload both to backend
      await saveCroppedImage(original, croppedFile, state.croppedAreaPixels);

      // Trigger browser download
      const link = document.createElement("a");
      link.href = URL.createObjectURL(croppedFile);
      link.download = `cropped-${state.fileName}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      // Invalidate history cache so the new crop appears
      queryClient.invalidateQueries({ queryKey: ["history"] });

      toast.success("Imagem recortada e salva com sucesso!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar recorte";
      dispatch({ type: "SET_ERROR", error: message });
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [state.imageSrc, state.croppedAreaPixels, state.fileName, state.mimeType, queryClient]);

  const handleReset = useCallback(() => {
    if (state.imageSrc) URL.revokeObjectURL(state.imageSrc);
    originalFileRef.current = null;
    dispatch({ type: "RESET" });
  }, [state.imageSrc]);

  // Compute aspect ratio for cropper
  const aspect = ASPECT_MAP[state.aspectPreset] ?? (state.naturalWidth / state.naturalHeight || 1);

  // Compute displayed crop dimensions
  const displayWidth = state.croppedAreaPixels?.width ?? state.naturalWidth;
  const displayHeight = state.croppedAreaPixels?.height ?? state.naturalHeight;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-on-surface font-headline">
          Recortar Imagem
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Recorte suas imagens com precisão.
        </p>
      </div>

      {/* Error */}
      {state.error && (
        <div role="alert" className="rounded-lg border border-error/20 bg-error-container/10 px-4 py-3 text-sm text-error">
          {state.error}
        </div>
      )}

      {/* Idle — upload zone */}
      {state.step === "idle" && (
        <CropUploadZone
          onImageLoaded={handleImageLoaded}
          onError={(msg) => dispatch({ type: "SET_ERROR", error: msg })}
        />
      )}

      {/* Loaded — cropper + toolbar */}
      {state.step === "loaded" && state.imageSrc && (
        <div className="space-y-4">
          {/* Cropper area */}
          <div className="relative h-[60vh] min-h-[300px] rounded-2xl overflow-hidden bg-surface-container">
            <Cropper
              image={state.imageSrc}
              crop={state.crop}
              zoom={state.zoom}
              rotation={state.rotation}
              aspect={aspect}
              onCropChange={(crop) => dispatch({ type: "SET_CROP", crop })}
              onZoomChange={(zoom) => dispatch({ type: "SET_ZOOM", zoom })}
              onRotationChange={(rotation) => dispatch({ type: "SET_ROTATION", rotation })}
              onCropComplete={handleCropComplete}
            />
          </div>

          {/* Toolbar */}
          <CropToolbar
            aspectPreset={state.aspectPreset}
            zoom={state.zoom}
            croppedWidth={displayWidth}
            croppedHeight={displayHeight}
            isSaving={isSaving}
            onAspectChange={(preset) => dispatch({ type: "SET_ASPECT", preset })}
            onZoomChange={(zoom) => dispatch({ type: "SET_ZOOM", zoom })}
            onReset={handleReset}
            onSave={handleSaveAndDownload}
          />
        </div>
      )}
    </div>
  );
}
