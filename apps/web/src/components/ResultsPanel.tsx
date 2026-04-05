import { useAppStore } from "@/stores/app-store";

function formatSize(kb: number) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

const ADJUSTMENT_LABELS: Record<string, { label: string; text: string }> = {
  resized: { label: "Redimensionado", text: "Resize" },
  smart_cropped: { label: "Cortado (Smart Crop)", text: "Crop" },
  format_converted: { label: "Formato Convertido", text: "Convert" },
  compressed: { label: "Comprimido", text: "Compress" },
};

export function ResultsPanel() {
  const { step, processedResult, originalImage, uploadId } = useAppStore();

  if (step !== "processed" || !processedResult || !originalImage) return null;

  const downloadUrl = `/api/v1/images/${uploadId}/download`;
  const reduction = Math.round((1 - processedResult.processed.size_kb / originalImage.sizeKb) * 100);

  return (
    <div className="glass-card space-y-6 rounded-xl p-6">
      {/* Status label */}
      <div>
        <span className="text-primary font-mono text-sm tracking-widest uppercase">Otimização Completa</span>
        <div className="flex items-center gap-3 mt-1">
          <h3 className="text-3xl font-extrabold tracking-tight font-headline text-on-surface">Resultado Final</h3>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/30">
            <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </span>
        </div>
      </div>

      {/* Before / After Comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-container-high/60 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            <span className="h-1.5 w-1.5 rounded-full bg-outline" />
            ANTES
          </span>
          <div className="overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container/60">
            <img src={originalImage.url} alt="Original" className="h-48 w-full object-contain" />
          </div>
        </div>
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(133,173,255,0.5)]" />
            DEPOIS
          </span>
          <div className="overflow-hidden rounded-lg border border-primary/30 bg-surface-container/60 shadow-[0_0_15px_rgba(133,173,255,0.08)]">
            <img src={downloadUrl} alt="Processada" className="h-48 w-full object-contain" />
          </div>
        </div>
      </div>

      {/* Transformation stats bar */}
      <div className="flex items-center justify-center gap-6 rounded-lg bg-surface-container/60 py-3 font-mono text-sm border border-outline-variant/10">
        {/* Dimensions */}
        <div className="flex items-center gap-2">
          <span className="text-on-surface-variant">{originalImage.width}×{originalImage.height}</span>
          <svg className="h-4 w-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
          <span className="text-primary font-semibold">{processedResult.processed.width}×{processedResult.processed.height}</span>
        </div>
        <div className="h-4 w-px bg-outline-variant/30" />
        {/* File weight */}
        <div className="flex items-center gap-2">
          <span className="text-on-surface-variant">{formatSize(originalImage.sizeKb)}</span>
          <svg className="h-4 w-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
          <span className="text-primary font-semibold">{formatSize(processedResult.processed.size_kb)}</span>
          <span className="rounded-full bg-gradient-to-r from-emerald-600/30 to-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            -{reduction}%
          </span>
        </div>
      </div>

      {/* Adjustment Badges */}
      {processedResult.adjustments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {processedResult.adjustments.map((adj: string) => {
            const meta = ADJUSTMENT_LABELS[adj] || { label: adj, text: adj };
            return (
              <span
                key={adj}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container/10 border border-secondary-container/20 px-3 py-1 text-sm text-primary"
              >
                <span className="text-xs font-mono uppercase text-on-surface-variant">{meta.text}</span>
                {meta.label}
              </span>
            );
          })}
        </div>
      )}

      {/* AI Explanation */}
      {processedResult.explanation && (
        <div className="relative rounded-2xl bg-surface-container-low p-8 overflow-hidden">
          {/* Glow blobs */}
          <div className="absolute -top-16 -left-16 w-32 h-32 bg-primary/8 blur-[60px] rounded-full" />
          <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-secondary/8 blur-[60px] rounded-full" />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-surface font-headline">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-dim text-[10px] font-bold text-white shadow-[0_0_8px_rgba(133,173,255,0.3)]">
                ✦
              </span>
              Relatório da Assistente IA
            </div>
            <p className="text-sm leading-relaxed text-on-surface-variant">{processedResult.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
