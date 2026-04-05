import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { toast } from "sonner";

const FORMAT_OPTIONS = [
  { value: "png", label: "PNG", desc: "Melhor qualidade, suporta transparência" },
  { value: "jpg", label: "JPG", desc: "Menor tamanho, sem transparência" },
  { value: "webp", label: "WebP", desc: "Melhor compressão, moderno" },
] as const;

export function DownloadSection() {
  const { step, uploadId, reset, processedResult, originalImage } = useAppStore();
  const defaultFormat = processedResult?.processed?.format === "jpeg" ? "jpg" : processedResult?.processed?.format || "webp";
  const [selectedFormat, setSelectedFormat] = useState(defaultFormat);

  if (step !== "processed" || !uploadId) return null;

  const downloadUrl = `/api/v1/images/${uploadId}/download?format=${selectedFormat}`;

  const handleNewImage = () => {
    // Add to history before resetting
    if (processedResult && originalImage) {
      useAppStore.setState((state) => ({
        history: [
          {
            id: uploadId,
            filename: originalImage.filename,
            typeName: processedResult.processed?.format || "—",
            beforeSize: `${originalImage.sizeKb >= 1024 ? (originalImage.sizeKb / 1024).toFixed(1) + " MB" : originalImage.sizeKb + " KB"}`,
            afterSize: `${processedResult.processed.size_kb >= 1024 ? (processedResult.processed.size_kb / 1024).toFixed(1) + " MB" : processedResult.processed.size_kb + " KB"}`,
            status: "processed" as const,
          },
          ...state.history,
        ],
      }));
    }
    reset();
    toast.info("Pronto para nova imagem", { description: "Envie uma nova imagem para processar." });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="glass-card space-y-5 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-on-surface font-headline">
        Finalizar Exportação
      </h3>

      {/* Format Radio Cards */}
      <div className="grid grid-cols-3 gap-3">
        {FORMAT_OPTIONS.map((fmt) => (
          <button
            key={fmt.value}
            onClick={() => setSelectedFormat(fmt.value)}
            className={`relative rounded-xl border p-4 text-left transition-all duration-200 ${
              selectedFormat === fmt.value
                ? "border-primary/50 bg-primary/10 ring-1 ring-primary/40 shadow-[0_0_15px_rgba(133,173,255,0.12)]"
                : "border-outline-variant/20 bg-surface-container/40 hover:border-outline-variant/40 hover:bg-surface-container-high/40"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                selectedFormat === fmt.value ? "border-primary" : "border-outline"
              }`}>
                {selectedFormat === fmt.value && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </span>
              <span className="text-sm font-semibold text-on-surface">{fmt.label}</span>
            </div>
            <p className="text-xs text-on-surface-variant pl-6">{fmt.desc}</p>
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <a
          href={downloadUrl}
          download
          onClick={() => toast.success("Download iniciado!", { description: "A imagem processada está sendo baixada." })}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-3 text-sm font-semibold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Baixar Imagem Processada
        </a>
        <button
          onClick={handleNewImage}
          className="rounded-xl border border-outline-variant/30 bg-surface-container/40 px-6 py-3 text-sm font-medium text-on-surface-variant backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-surface-container-high/60 hover:text-on-surface hover:shadow-[0_0_15px_rgba(133,173,255,0.08)]"
        >
          Processar Nova Imagem
        </button>
      </div>
    </div>
  );
}
