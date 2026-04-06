import { useState, useEffect } from "react";
import { useGateStore } from "@/stores/gate-store";
import { getGateHistory } from "@/lib/api";

export function GateResultsDashboard() {
  const { selectedConfigId, results, setResults } = useGateStore();
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    if (!selectedConfigId) return;
    getGateHistory(selectedConfigId, filter || undefined).then((data) => setResults(data.results || [])).catch(() => {});
  }, [selectedConfigId, filter, setResults]);

  if (!selectedConfigId) return null;

  const passCount = results.filter((r) => r.verdict === "pass").length;
  const failCount = results.filter((r) => r.verdict === "fail").length;
  const warnCount = results.filter((r) => r.verdict === "warn").length;
  const passRate = results.length > 0 ? Math.round((passCount / results.length) * 100) : 0;

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-on-surface font-headline">Histórico de Validações</h3>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg bg-success-container p-2 text-center">
          <div className="text-lg font-bold text-success">{passCount}</div>
          <div className="text-[10px] text-on-surface-variant">Pass</div>
        </div>
        <div className="rounded-lg bg-error/10 p-2 text-center">
          <div className="text-lg font-bold text-error">{failCount}</div>
          <div className="text-[10px] text-on-surface-variant">Fail</div>
        </div>
        <div className="rounded-lg bg-warning-container p-2 text-center">
          <div className="text-lg font-bold text-warning">{warnCount}</div>
          <div className="text-[10px] text-on-surface-variant">Warn</div>
        </div>
        <div className="rounded-lg bg-primary/10 p-2 text-center">
          <div className="text-lg font-bold text-primary">{passRate}%</div>
          <div className="text-[10px] text-on-surface-variant">Taxa</div>
        </div>
      </div>

      <div className="flex gap-1">
        {["", "pass", "fail", "warn"].map((v) => (
          <button key={v} onClick={() => setFilter(v)} className={`rounded-md px-2 py-1 text-xs ${filter === v ? "bg-primary/20 text-primary" : "text-on-surface-variant hover:bg-surface-container-high"}`}>
            {v || "Todos"}
          </button>
        ))}
      </div>

      {results.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-outline-variant/20 text-left">
                <th className="pb-2 text-on-surface-variant font-medium">Data</th>
                <th className="pb-2 text-on-surface-variant font-medium">Fonte</th>
                <th className="pb-2 text-on-surface-variant font-medium">Score</th>
                <th className="pb-2 text-on-surface-variant font-medium">Veredito</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant/10">
                  <td className="py-1.5 text-on-surface-variant">{new Date(r.checkedAt).toLocaleString("pt-BR")}</td>
                  <td className="py-1.5 text-on-surface-variant">{r.source}</td>
                  <td className="py-1.5 font-medium text-on-surface">{r.qualityScore}</td>
                  <td className="py-1.5">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      r.verdict === "pass" ? "bg-success-container text-success"
                      : r.verdict === "fail" ? "bg-error-container text-error"
                      : "bg-warning-container text-warning"
                    }`}>
                      {r.verdict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant text-center py-4">Nenhuma validação registrada.</p>
      )}
    </div>
  );
}
