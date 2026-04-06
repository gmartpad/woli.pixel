import { cn } from "@/lib/utils";
import type { AspectPreset } from "./crop-page-reducer";

const ASPECT_PRESETS: { value: AspectPreset; label: string }[] = [
  { value: "free", label: "Livre" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

type CropToolbarProps = {
  aspectPreset: AspectPreset;
  zoom: number;
  croppedWidth: number;
  croppedHeight: number;
  isSaving: boolean;
  onAspectChange: (preset: AspectPreset) => void;
  onZoomChange: (zoom: number) => void;
  onReset: () => void;
  onSave: () => void;
};

export function CropToolbar({
  aspectPreset,
  zoom,
  croppedWidth,
  croppedHeight,
  isSaving,
  onAspectChange,
  onZoomChange,
  onReset,
  onSave,
}: CropToolbarProps) {
  return (
    <div className="rounded-2xl bg-surface-container/80 backdrop-blur-md border border-outline-variant/10 p-4 space-y-3">
      {/* Aspect presets */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ASPECT_PRESETS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onAspectChange(value)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              aspectPreset === value
                ? "bg-primary/15 text-primary"
                : "text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-3">
        <label htmlFor="crop-zoom" className="text-sm text-on-surface-variant shrink-0">
          Zoom
        </label>
        <input
          id="crop-zoom"
          type="range"
          role="slider"
          aria-label="Zoom"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="text-sm text-on-surface-variant tabular-nums w-10 text-right">
          {zoom.toFixed(1)}x
        </span>
      </div>

      {/* Dimensions + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-on-surface-variant tabular-nums">
          {croppedWidth} × {croppedHeight} px
        </span>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Nova Imagem
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              isSaving
                ? "bg-primary/50 text-on-primary/70 cursor-not-allowed"
                : "bg-primary text-on-primary hover:bg-primary/90",
            )}
          >
            {isSaving ? "Salvando..." : "Salvar e Baixar"}
          </button>
        </div>
      </div>
    </div>
  );
}
