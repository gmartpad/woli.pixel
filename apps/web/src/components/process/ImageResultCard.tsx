import { useState } from "react";
import { formatSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuthImage } from "@/hooks/useAuthImage";
import { BeforeAfterLightbox } from "./BeforeAfterLightbox";

const ADJUSTMENT_LABELS: Record<string, { label: string; text: string }> = {
  resized: { label: "Redimensionado", text: "Resize" },
  smart_cropped: { label: "Cortado (Smart Crop)", text: "Crop" },
  user_cropped: { label: "Recortado pelo Usuário", text: "User_Cropped" },
  format_converted: { label: "Formato Convertido", text: "Convert" },
  compressed: { label: "Comprimido", text: "Compress" },
};

type Props = {
  original: {
    url: string;
    width: number;
    height: number;
    sizeKb: number;
  };
  processed: {
    url: string;
    width: number;
    height: number;
    sizeKb: number;
  };
  adjustments: string[];
  explanation: string | null;
};

export function ImageResultCard({ original, processed, adjustments, explanation }: Props) {
  const [lightboxSlide, setLightboxSlide] = useState<0 | 1 | null>(null);
  // processed.url is always an API endpoint — fetch with Bearer token
  const { src: processedSrc } = useAuthImage(processed.url);

  const sizeChange = Math.round(
    (1 - processed.sizeKb / original.sizeKb) * 100,
  );
  const isReduction = sizeChange > 0;

  return (
    <div className="space-y-6">
      {/* Before / After Thumbnail Grid */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setLightboxSlide(0)}
          className="group relative overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container/60"
        >
          <img
            src={original.url}
            alt="Original"
            className="h-36 w-full object-contain transition-transform group-hover:scale-105"
          />
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            ANTES
          </span>
        </button>
        <button
          type="button"
          onClick={() => setLightboxSlide(1)}
          className="group relative overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container/60"
        >
          {processedSrc ? (
            <img
              src={processedSrc}
              alt="Processada"
              className="h-36 w-full object-contain transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-36 w-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            DEPOIS
          </span>
        </button>
      </div>

      {lightboxSlide !== null && processedSrc && (
        <BeforeAfterLightbox
          originalSrc={original.url}
          processedSrc={processedSrc}
          initialSlide={lightboxSlide}
          onClose={() => setLightboxSlide(null)}
        />
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-center gap-6 rounded-lg bg-surface-container/60 py-3 font-mono text-sm border border-outline-variant/10">
        <div className="flex items-center gap-2">
          <span className="text-on-surface-variant">
            {original.width}x{original.height}
          </span>
          <svg
            className="h-4 w-4 text-outline"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
          <span className="text-primary font-semibold">
            {processed.width}x{processed.height}
          </span>
        </div>
        <div className="h-4 w-px bg-outline-variant/30" />
        <div className="flex items-center gap-2">
          <span className="text-on-surface-variant">
            {formatSize(original.sizeKb)}
          </span>
          <svg
            className="h-4 w-4 text-outline"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
          <span className="text-primary font-semibold">
            {formatSize(processed.sizeKb)}
          </span>
          <span className={cn(
            "rounded-full px-3 py-0.5 text-xs font-bold ring-1",
            isReduction
              ? "bg-gradient-to-r from-emerald-600/30 to-emerald-500/20 text-emerald-400 ring-emerald-500/20"
              : "bg-gradient-to-r from-red-600/30 to-red-500/20 text-red-400 ring-red-500/20"
          )}>
            {isReduction ? `-${sizeChange}%` : `+${Math.abs(sizeChange)}%`}
          </span>
        </div>
      </div>

      {/* Adjustment Badges */}
      {adjustments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {adjustments.map((adj) => {
            const meta = ADJUSTMENT_LABELS[adj] || { label: adj, text: adj };
            return (
              <span
                key={adj}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container/10 border border-secondary-container/20 px-3 py-1 text-sm text-primary"
              >
                <span className="text-xs font-mono uppercase text-on-surface-variant">
                  {meta.text}
                </span>
                {meta.label}
              </span>
            );
          })}
        </div>
      )}

      {/* AI Explanation */}
      {explanation && (
        <div className="relative rounded-2xl bg-surface-container-low p-8 overflow-hidden">
          <div className="absolute -top-16 -left-16 w-32 h-32 bg-primary/8 blur-[60px] rounded-full" />
          <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-secondary/8 blur-[60px] rounded-full" />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-surface font-headline">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-dim text-[10px] font-bold text-white shadow-[0_0_8px_rgba(133,173,255,0.3)]">
                AI
              </span>
              Relatório da Assistente IA
            </div>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              {explanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
