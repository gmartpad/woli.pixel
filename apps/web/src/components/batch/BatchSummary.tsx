import { useBatchStore } from "@/stores/batch-store";

export function BatchSummary() {
  const { images, batchStep } = useBatchStore();
  if (batchStep !== "reviewed" && batchStep !== "completed") return null;

  const analyzed = images.filter((i) => i.qualityScore !== null);
  const avgScore = analyzed.length > 0
    ? Math.round((analyzed.reduce((sum, i) => sum + (i.qualityScore || 0), 0) / analyzed.length) * 10) / 10
    : 0;
  const passed = analyzed.filter((i) => (i.qualityScore || 0) >= 7).length;
  const failed = analyzed.length - passed;

  // Count issue frequency
  const issueMap: Record<string, number> = {};
  for (const img of images) {
    if (img.analysis?.quality.issues) {
      for (const issue of img.analysis.quality.issues) {
        issueMap[issue] = (issueMap[issue] || 0) + 1;
      }
    }
  }
  const topIssues = Object.entries(issueMap).sort(([, a], [, b]) => b - a).slice(0, 3);

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-on-surface font-headline">Resumo do Lote</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg bg-surface-container-low p-3 text-center">
          <div className="text-2xl font-bold text-on-surface">{images.length}</div>
          <div className="text-xs text-on-surface-variant">Total</div>
        </div>
        <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{passed}</div>
          <div className="text-xs text-on-surface-variant">Aprovadas</div>
        </div>
        <div className="rounded-lg bg-error/10 p-3 text-center">
          <div className="text-2xl font-bold text-error">{failed}</div>
          <div className="text-xs text-on-surface-variant">Reprovadas</div>
        </div>
        <div className="rounded-lg bg-primary/10 p-3 text-center">
          <div className="text-2xl font-bold text-primary">{avgScore}</div>
          <div className="text-xs text-on-surface-variant">Score Médio</div>
        </div>
      </div>

      {topIssues.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-on-surface-variant mb-2">Problemas mais comuns</div>
          {topIssues.map(([issue, count]) => (
            <div key={issue} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-on-surface-variant truncate flex-1">{issue}</span>
              <span className="text-xs text-outline ml-2">{count}x</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
