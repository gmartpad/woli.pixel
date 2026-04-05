import { useBatchStore } from "@/stores/batch-store";

const STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  pending: { bg: "bg-surface-container-high", label: "Pendente" },
  uploading: { bg: "bg-yellow-500/20", label: "Enviando" },
  uploaded: { bg: "bg-blue-500/20", label: "Enviado" },
  analyzing: { bg: "bg-yellow-500/20", label: "Analisando" },
  analyzed: { bg: "bg-emerald-500/20", label: "Analisado" },
  processing: { bg: "bg-yellow-500/20", label: "Processando" },
  processed: { bg: "bg-emerald-500/20", label: "Concluído" },
  error: { bg: "bg-error/20", label: "Erro" },
};

export function BatchProgressGrid() {
  const { images, batchStep } = useBatchStore();
  if (batchStep !== "uploading" && batchStep !== "analyzing" && batchStep !== "processing") return null;

  const completed = images.filter((i) => i.status === "analyzed" || i.status === "processed").length;
  const progress = images.length > 0 ? Math.round((completed / images.length) * 100) : 0;

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-on-surface font-headline">Progresso do Lote</h3>

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
        {completed} de {images.length} imagens processadas
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {images.map((img, i) => {
          const style = STATUS_STYLES[img.status] || { bg: "bg-surface-container-high", label: "Pendente" };
          return (
            <div key={i} className={`rounded-lg p-1.5 ${style.bg} border border-outline-variant/10`}>
              <img src={URL.createObjectURL(img.file)} alt="" className="h-12 w-full object-cover rounded" />
              <p className="text-[9px] text-on-surface-variant mt-1 truncate">{style.label}</p>
              {img.qualityScore !== null && (
                <p className={`text-[10px] font-bold ${img.qualityScore >= 7 ? "text-emerald-400" : img.qualityScore >= 5 ? "text-yellow-400" : "text-error"}`}>
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
