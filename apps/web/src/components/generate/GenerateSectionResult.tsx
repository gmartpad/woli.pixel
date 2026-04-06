import { useState, useEffect } from "react";
import { useGenerationStore } from "@/stores/generation-store";
import { FormatSelector } from "@/components/FormatSelector";

const MODEL_LABELS: Record<string, { name: string; description: string }> = {
  recraft_v3: { name: "Recraft V3", description: "Design assets, logos, ícones" },
  flux2_pro: { name: "FLUX.2 Pro", description: "Fundos, capas, conteúdo fotorrealista" },
};

export function GenerateSectionResult() {
  const step = useGenerationStore((s) => s.step);
  const result = useGenerationStore((s) => s.result);
  const reset = useGenerationStore((s) => s.reset);

  const [downloadFormat, setDownloadFormat] = useState("jpeg");

  useEffect(() => {
    if (result?.image?.format) {
      const fmt = result.image.format.toLowerCase();
      setDownloadFormat(fmt === "jpg" ? "jpeg" : fmt);
    }
  }, [result]);

  if (!result || step !== "completed") {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-on-surface-variant">Nenhuma imagem gerada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-on-surface font-headline">Imagem Gerada</h3>
        <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-mono text-primary">
          ${result.cost_usd.toFixed(3)}
        </span>
      </div>

      {/* Preview */}
      <div className="flex justify-center rounded-lg bg-surface-container-low p-4">
        <img
          src={`${import.meta.env.VITE_API_URL || "/api/v1"}${result.image.download_url.replace("/api/v1", "")}`}
          alt="Generated"
          className="max-h-96 rounded-lg object-contain"
        />
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2 text-xs text-on-surface-variant">
        <span className="rounded-md bg-surface-container-high px-2 py-1">
          {result.image.width}x{result.image.height}px
        </span>
        <span className="rounded-md bg-surface-container-high px-2 py-1">
          {result.image.format.toUpperCase()}
        </span>
        <span className="rounded-md bg-surface-container-high px-2 py-1">
          {result.image.size_kb} KB
        </span>
        <span className={`rounded-md px-2 py-1 ${
          result.model === "flux2_pro"
            ? "bg-blue-500/15 text-blue-400"
            : "bg-emerald-500/15 text-emerald-400"
        }`}>
          {MODEL_LABELS[result.model]?.name || result.model}
        </span>
      </div>

      {/* Format + Download */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-on-surface-variant">Formato de download</span>
          <FormatSelector selected={downloadFormat} onChange={setDownloadFormat} />
        </div>
        <div className="flex gap-3">
          <a
            href={`${import.meta.env.VITE_API_URL || "/api/v1"}${result.image.download_url.replace("/api/v1", "")}?format=${downloadFormat}`}
            download
            className="flex-1 rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-2.5 text-center font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)]"
          >
            Download
          </a>
          <button
            onClick={reset}
            className="rounded-xl border border-outline-variant/20 px-6 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
          >
            Nova Geração
          </button>
        </div>
      </div>
    </div>
  );
}
