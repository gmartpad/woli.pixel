import { useAuditStore } from "@/stores/audit-store";
import { exportAuditCsv } from "@/lib/api";

export function AuditReport() {
  const { step, currentJob, report } = useAuditStore();
  if (step !== "report" || !report || !currentJob) return null;

  const handleExportCsv = async () => {
    const blob = await exportAuditCsv(currentJob.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${currentJob.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxDist = Math.max(...Object.values(report.score_distribution), 1);

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold font-headline text-on-surface">Relatório: {currentJob.name}</h3>
          <button onClick={handleExportCsv} className="rounded-lg bg-surface-container-high px-3 py-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
            Exportar CSV
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-surface-container-low p-3 text-center">
            <div className="text-2xl font-bold text-on-surface">{report.summary.total}</div>
            <div className="text-xs text-on-surface-variant">Total</div>
          </div>
          <div className="rounded-lg bg-success-container p-3 text-center">
            <div className="text-2xl font-bold text-success">{report.summary.passed}</div>
            <div className="text-xs text-on-surface-variant">Aprovadas</div>
          </div>
          <div className="rounded-lg bg-error/10 p-3 text-center">
            <div className="text-2xl font-bold text-error">{report.summary.failed}</div>
            <div className="text-xs text-on-surface-variant">Reprovadas</div>
          </div>
          <div className="rounded-lg bg-primary/10 p-3 text-center">
            <div className="text-2xl font-bold text-primary">{report.summary.avg_score}</div>
            <div className="text-xs text-on-surface-variant">Score Médio</div>
          </div>
        </div>
      </div>

      {/* Score Distribution */}
      <div className="glass-card rounded-xl p-6 space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Distribuição de Scores</h4>
        {Object.entries(report.score_distribution).map(([range, count]) => (
          <div key={range} className="flex items-center gap-3">
            <span className="w-10 text-xs text-on-surface-variant text-right">{range}</span>
            <div className="flex-1 h-5 bg-surface-container-high rounded overflow-hidden">
              <div className="h-full bg-primary/60 rounded transition-all" style={{ width: `${(count / maxDist) * 100}%` }} />
            </div>
            <span className="w-8 text-xs text-outline text-right">{count}</span>
          </div>
        ))}
      </div>

      {/* Top Issues */}
      {report.top_issues.length > 0 && (
        <div className="glass-card rounded-xl p-6 space-y-3">
          <h4 className="text-sm font-semibold text-on-surface">Problemas Mais Frequentes</h4>
          {report.top_issues.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant flex-1 truncate">{item.issue}</span>
              <span className="text-xs text-outline ml-2">{item.count}x ({item.percentage}%)</span>
            </div>
          ))}
        </div>
      )}

      {/* Worst Offenders */}
      {report.worst_offenders.length > 0 && (
        <div className="glass-card rounded-xl p-6 space-y-3">
          <h4 className="text-sm font-semibold text-on-surface">Piores Imagens</h4>
          <div className="space-y-2">
            {report.worst_offenders.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-surface-container-low p-3">
                <span className="text-sm text-on-surface truncate flex-1">{item.filename}</span>
                <span className={`text-sm font-bold ml-2 ${item.score >= 7 ? "text-success" : item.score >= 5 ? "text-warning" : "text-error"}`}>
                  {item.score}/10
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
