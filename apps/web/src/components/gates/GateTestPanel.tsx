import { useState } from "react";
import { useGateStore, type GateEvaluation } from "@/stores/gate-store";
import { validateImageWithGate } from "@/lib/api";

export function GateTestPanel() {
  const { selectedConfigId, configs } = useGateStore();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<GateEvaluation | null>(null);
  const [loading, setLoading] = useState(false);

  const config = configs.find((c) => c.id === selectedConfigId);
  if (!config) return null;

  const handleTest = async () => {
    if (!file || !selectedConfigId) return;
    setLoading(true);
    setResult(null);
    try {
      const evaluation = await validateImageWithGate(selectedConfigId, file, "manual");
      setResult(evaluation);
    } catch (err) {
      console.error("Gate test error:", err);
    } finally {
      setLoading(false);
    }
  };

  const verdictStyles = {
    pass: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "APROVADO" },
    fail: { bg: "bg-error/20", text: "text-error", label: "REPROVADO" },
    warn: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "ALERTA" },
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-on-surface font-headline">Testar: {config.name}</h3>

      <div className="relative flex min-h-[100px] items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low/50">
        <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} className="absolute inset-0 cursor-pointer opacity-0" />
        <p className="text-sm text-on-surface-variant">{file ? file.name : "Selecione uma imagem para testar"}</p>
      </div>

      <button
        onClick={handleTest}
        disabled={!file || loading}
        className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-on-primary disabled:opacity-50"
      >
        {loading ? "Validando..." : "Testar"}
      </button>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={`rounded-lg px-3 py-1.5 text-sm font-bold ${verdictStyles[result.verdict].bg} ${verdictStyles[result.verdict].text}`}>
              {verdictStyles[result.verdict].label}
            </span>
            <span className="text-sm text-on-surface-variant">Score: <strong className="text-on-surface">{result.quality_score}/10</strong></span>
          </div>

          {result.failures.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-error">Falhas</div>
              {result.failures.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-on-surface-variant">
                  <svg className="h-3.5 w-3.5 text-error mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  {f}
                </div>
              ))}
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-yellow-400">Alertas</div>
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-on-surface-variant">
                  <svg className="h-3.5 w-3.5 text-yellow-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                  {w}
                </div>
              ))}
            </div>
          )}

          {result.failures.length === 0 && result.warnings.length === 0 && (
            <p className="text-xs text-emerald-400">Todos os critérios atendidos.</p>
          )}
        </div>
      )}
    </div>
  );
}
