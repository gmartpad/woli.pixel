import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HistoryItem } from "@/lib/api";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

const MODEL_NAMES: Record<string, string> = {
  recraft_v3: "Recraft V3",
  flux2_pro: "FLUX.2 Pro",
};

const QUALITY_NAMES: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

type Props = {
  item: HistoryItem;
  onClose: () => void;
  onOpenLightbox: (mode: "single" | "compare") => void;
  onDelete: () => void;
  onRegenerate: () => void;
};

function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type MetaRow = { label: string; value: string };

function buildMetadata(item: HistoryItem): MetaRow[] {
  const rows: MetaRow[] = [
    { label: "Tipo", value: item.displayName || item.imageTypeName || "Personalizado" },
    { label: "Categoria", value: item.category || "\u2014" },
    {
      label: "Dimensões",
      value:
        item.finalWidth && item.finalHeight
          ? `${item.finalWidth}×${item.finalHeight}px`
          : "\u2014",
    },
    { label: "Formato", value: item.finalFormat?.toUpperCase() || "\u2014" },
    { label: "Tamanho", value: item.finalSizeKb ? `${item.finalSizeKb} KB` : "\u2014" },
    { label: "Criado em", value: formatDateTime(item.createdAt) },
  ];

  if (item.mode === "generation") {
    rows.push({
      label: "Modelo",
      value: (item.model && MODEL_NAMES[item.model]) || item.model || "\u2014",
    });
    rows.push({
      label: "Qualidade",
      value: (item.qualityTier && QUALITY_NAMES[item.qualityTier]) || item.qualityTier || "\u2014",
    });
    rows.push({
      label: "Custo",
      value: item.costUsd != null ? `$${item.costUsd.toFixed(3)}` : "\u2014",
    });
  }

  if (item.mode === "upload") {
    if (item.originalFilename) {
      rows.push({ label: "Arquivo", value: item.originalFilename });
    }
    if (item.originalWidth && item.originalHeight && item.originalSizeKb && item.finalWidth && item.finalHeight && item.finalSizeKb) {
      rows.push({
        label: "Antes → Depois",
        value: `${item.originalWidth}×${item.originalHeight} ${item.originalSizeKb}KB → ${item.finalWidth}×${item.finalHeight} ${item.finalSizeKb}KB`,
      });
    }
  }

  return rows;
}

export function HistoryDetailPanel({ item, onClose, onOpenLightbox, onDelete, onRegenerate }: Props) {
  const [showEnhanced, setShowEnhanced] = useState(false);

  const title = item.displayName || item.imageTypeName || item.originalFilename || "Personalizado";
  const thumbnailSrc = `${API_URL}${item.thumbnailUrl.replace("/api/v1", "")}`;
  const downloadHref = `${API_URL}${item.downloadUrl.replace("/api/v1", "")}`;
  const metadata = buildMetadata(item);

  const hasEnhancedPrompt =
    item.mode === "generation" &&
    item.enhancedPrompt &&
    item.enhancedPrompt !== item.prompt;

  return (
    <aside className="flex h-full flex-col overflow-y-auto border-l border-outline-variant/50 bg-surface-container-lowest">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-4">
        <h2 className="truncate text-base font-semibold text-on-surface">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high"
        >
          ✕
        </button>
      </div>

      {/* Image Preview */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={() => onOpenLightbox("single")}
          aria-label="Ampliar imagem"
          className="w-full cursor-zoom-in overflow-hidden rounded-lg bg-surface-container"
        >
          <img
            src={thumbnailSrc}
            alt={title}
            className="h-auto w-full object-contain"
          />
        </button>
      </div>

      {/* Metadata Table */}
      <div className="px-4 pb-4">
        <table className="w-full text-sm">
          <tbody>
            {metadata.map((row) => (
              <tr
                key={row.label}
                className="text-on-surface border-b border-outline-variant/50"
              >
                <td className="py-2 pr-3 text-on-surface-variant">{row.label}</td>
                <td className="py-2 font-medium">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Prompt Section (generation only) */}
      {item.mode === "generation" && item.prompt && (
        <div className="px-4 pb-4">
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            Prompt
          </h3>
          <p className="text-sm text-on-surface">{item.prompt}</p>

          {hasEnhancedPrompt && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowEnhanced((v) => !v)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {showEnhanced ? "Ocultar prompt aprimorado" : "Prompt aprimorado"}
              </button>
              {showEnhanced && (
                <p className="mt-1 text-sm text-on-surface-variant">
                  {item.enhancedPrompt}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/30 p-4">
        <a
          href={downloadHref}
          download
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:bg-primary-dim"
        >
          Download
        </a>

        {item.mode === "upload" && (
          <button
            type="button"
            onClick={() => onOpenLightbox("compare")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-bright"
          >
            Comparar
          </button>
        )}

        {item.mode === "generation" && (
          <button
            type="button"
            onClick={onRegenerate}
            aria-label="Re-gerar"
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-bright"
          >
            Re-gerar
          </button>
        )}

        <button
          type="button"
          onClick={onDelete}
          aria-label="Excluir"
          className="inline-flex items-center gap-1.5 rounded-lg bg-error-container/20 px-3 py-2 text-sm font-medium text-error hover:bg-error-container/40"
        >
          Excluir
        </button>
      </div>
    </aside>
  );
}
