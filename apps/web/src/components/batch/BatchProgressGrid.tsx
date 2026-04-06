import { useBatchStore } from "@/stores/batch-store";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  pending: { bg: "bg-surface-container-high", label: "Pendente" },
  uploading: { bg: "bg-yellow-500/20", label: "Enviando" },
  uploaded: { bg: "bg-blue-500/20", label: "Enviado" },
  analyzing: { bg: "bg-yellow-500/20", label: "Analisando" },
  analyzed: { bg: "bg-success-container", label: "Analisado" },
  processing: { bg: "bg-yellow-500/20", label: "Processando" },
  processed: { bg: "bg-success-container", label: "Concluído" },
  error: { bg: "bg-error/20", label: "Erro" },
};

const STATUS_WEIGHT: Record<string, number> = {
  pending: 0,
  uploading: 0.15,
  uploaded: 0.30,
  analyzing: 0.55,
  analyzed: 0.85,
  processing: 0.90,
  processed: 1.0,
  error: 0,
};

const PHASE_LABEL: Record<string, string> = {
  uploading: "Enviando imagens...",
  analyzing: "Analisando imagens...",
  processing: "Processando imagens...",
};

export function BatchProgressGrid() {
  const { images, batchStep } = useBatchStore();
  if (batchStep !== "uploading" && batchStep !== "analyzing" && batchStep !== "processing") return null;

  const totalWeight = images.reduce((sum, img) => sum + (STATUS_WEIGHT[img.status] ?? 0), 0);
  const progress = images.length > 0 ? Math.round((totalWeight / images.length) * 100) : 0;
  const uploaded = images.filter((i) => ["uploaded", "analyzing", "analyzed", "processing", "processed"].includes(i.status)).length;
  const analyzed = images.filter((i) => ["analyzed", "processing", "processed"].includes(i.status)).length;
  const completed = images.filter((i) => i.status === "processed").length;
  const processing = images.filter((i) => i.status === "processing").length;

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-on-surface font-headline">
        {PHASE_LABEL[batchStep] ?? "Progresso do Lote"}
      </h3>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-dim to-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm font-medium text-primary">{progress}%</span>
      </div>

      <p className="text-sm text-on-surface-variant">
        {batchStep === "uploading"
          ? `${uploaded} de ${images.length} imagens enviadas`
          : batchStep === "analyzing"
            ? `${analyzed} de ${images.length} imagens analisadas`
            : batchStep === "processing" && completed === 0
              ? `Processando ${processing} imagens...`
              : `${completed} de ${images.length} imagens processadas`}
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {images.map((img, i) => {
          const style = STATUS_STYLES[img.status] || { bg: "bg-surface-container-high", label: "Pendente" };
          const isActive = img.status === "uploading" || img.status === "analyzing" || img.status === "processing";
          return (
            <div
              key={i}
              aria-busy={isActive || undefined}
              aria-label={img.file.name}
              className={cn("rounded-lg p-1.5 border border-outline-variant/10", style.bg, isActive && "animate-pulse")}
            >
              <img src={URL.createObjectURL(img.file)} alt="" className="h-12 w-full object-cover rounded" />
              <p className="text-[9px] text-on-surface-variant mt-1 truncate">{style.label}</p>
              {img.qualityScore !== null && (
                <p className={`text-[10px] font-bold ${img.qualityScore >= 7 ? "text-success" : img.qualityScore >= 5 ? "text-warning" : "text-error"}`}>
                  {img.qualityScore}/10
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
