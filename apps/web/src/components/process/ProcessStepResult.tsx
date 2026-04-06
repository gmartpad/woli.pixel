import { useState } from "react";
import { FormatSelector } from "@/components/FormatSelector";
import { ImageResultCard } from "./ImageResultCard";
import type { ProcessWizardState, ProcessWizardAction } from "./process-wizard-reducer";

type Props = {
  state: ProcessWizardState;
  dispatch: React.Dispatch<ProcessWizardAction>;
};

export function ProcessStepResult({ state, dispatch }: Props) {
  const { originalImage, result, uploadId } = state;
  const [selectedFormat, setSelectedFormat] = useState(
    (result?.processed as { format?: string })?.format || "jpeg",
  );

  if (!result || !originalImage) return null;

  const downloadUrl = `/api/v1/images/${uploadId}/download${selectedFormat ? `?format=${selectedFormat}` : ""}`;
  const processed = result.processed as {
    width: number;
    height: number;
    size_kb: number;
  };
  const adjustments = (result.adjustments ?? []) as string[];
  const explanation = result.explanation as string | undefined;

  return (
    <div className="glass-card space-y-6 rounded-xl p-6">
      {/* Status */}
      <div>
        <span className="text-primary font-mono text-sm tracking-widest uppercase">
          Otimização Completa
        </span>
        <div className="flex items-center gap-3 mt-1">
          <h3 className="text-3xl font-extrabold tracking-tight font-headline text-on-surface">
            Resultado Final
          </h3>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/30">
            <svg
              className="h-3.5 w-3.5 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </span>
        </div>
      </div>

      <ImageResultCard
        original={{
          url: originalImage.url,
          width: originalImage.width,
          height: originalImage.height,
          sizeKb: originalImage.sizeKb,
        }}
        processed={{
          url: downloadUrl,
          width: processed.width,
          height: processed.height,
          sizeKb: processed.size_kb,
        }}
        adjustments={adjustments}
        explanation={explanation ?? null}
      />

      {/* Format Selector + Actions */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-on-surface-variant">Formato:</span>
        <FormatSelector selected={selectedFormat} onChange={setSelectedFormat} />
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => dispatch({ type: "RESET" })}
          className="rounded-xl border border-outline-variant/30 px-6 py-3 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          Nova Imagem
        </button>
        <a
          href={downloadUrl}
          download
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-3 text-lg font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)]"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          Download
        </a>
      </div>
    </div>
  );
}
