import { useEffect } from "react";
import { useAuditStore } from "@/stores/audit-store";
import { getAudit, getAuditReport } from "@/lib/api";

export function AuditProgress() {
  const { step, currentJob, setStep, setCurrentJob, setItems, setReport } = useAuditStore();

  useEffect(() => {
    if (step !== "scanning" || !currentJob) return;

    const interval = setInterval(async () => {
      try {
        const data = await getAudit(currentJob.id);
        setCurrentJob({
          id: data.id,
          name: data.name,
          status: data.status,
          totalImages: data.totalImages,
          scannedImages: data.scannedImages,
          passedImages: data.passedImages,
          failedImages: data.failedImages,
          errorImages: data.errorImages,
          avgQualityScore: data.avgQualityScore ? parseFloat(data.avgQualityScore) : null,
          passThreshold: data.passThreshold,
        });
        if (data.items) setItems(data.items);

        if (data.status === "completed") {
          clearInterval(interval);
          const report = await getAuditReport(currentJob.id);
          setReport(report);
          setStep("report");
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [step, currentJob, setCurrentJob, setItems, setReport, setStep]);

  if (step !== "scanning" || !currentJob) return null;

  const progress = currentJob.totalImages > 0
    ? Math.round((currentJob.scannedImages / currentJob.totalImages) * 100)
    : 0;

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-on-surface font-headline">Escaneando...</h3>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 bg-surface-container-high rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary-dim to-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-sm font-medium text-primary">{progress}%</span>
      </div>

      <p className="text-sm text-on-surface-variant">
        {currentJob.scannedImages} de {currentJob.totalImages} imagens analisadas
      </p>

      {currentJob.errorImages > 0 && (
        <p className="text-xs text-error">{currentJob.errorImages} erros encontrados</p>
      )}

      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-outline">Análise de IA em andamento...</span>
      </div>
    </div>
  );
}
