import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchGenerationCosts } from "@/lib/api";

type QualityTier = "low" | "medium" | "high";

type PresetCost = {
  typeKey: string;
  displayName: string;
  targetWidth: number | null;
  targetHeight: number | null;
  openaiSize: string;
  costs: Record<QualityTier, number>;
  notes: string | null;
};

type CostResponse = {
  model: string;
  qualityLabels: Record<QualityTier, { label: string; description: string }>;
  presets: PresetCost[];
  totals: Record<QualityTier, number>;
  squareCount: number;
  nonSquareCount: number;
  notes: Record<string, string>;
};

const TIER_COLORS: Record<QualityTier, string> = {
  low: "text-outline",
  medium: "text-secondary",
  high: "text-primary",
};

export function CostEstimationPanel() {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = useQuery<CostResponse>({
    queryKey: ["generation-costs"],
    queryFn: fetchGenerationCosts,
    enabled: isOpen,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="glass-card rounded-xl">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 border border-primary/20">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
          <div>
            <h3 className="font-headline font-bold text-on-surface">Estimativa de Custos</h3>
            <p className="text-xs text-on-surface-variant">gpt-image-1-mini por preset Woli Pixel</p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-outline transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-outline-variant/10 p-4 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-sm text-outline">
              Carregando custos...
            </div>
          )}

          {data && (
            <>
              {/* Totals Summary */}
              <div className="grid grid-cols-3 gap-3">
                {(["low", "medium", "high"] as QualityTier[]).map((tier) => {
                  const labels = data.qualityLabels[tier];
                  return (
                    <div
                      key={tier}
                      className="rounded-lg bg-surface-container-low p-3 text-center"
                    >
                      <div className="text-xs font-medium text-on-surface-variant">{labels.label}</div>
                      <div className={`mt-1 text-xl font-bold font-mono ${TIER_COLORS[tier]}`}>
                        ${data.totals[tier].toFixed(3)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-outline">19 imagens</div>
                    </div>
                  );
                })}
              </div>

              {/* Breakdown */}
              <div className="text-xs text-on-surface-variant">
                {data.squareCount} presets quadrados (1024x1024) + {data.nonSquareCount} landscape/portrait (1536x1024)
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border border-outline-variant/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/10 bg-surface-container-low/50">
                      <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant">Preset</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-on-surface-variant">Alvo</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-on-surface-variant">OpenAI</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-outline">Rascunho</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-secondary">Padrao</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-primary">Alta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.presets.map((preset, i) => (
                      <tr
                        key={preset.typeKey}
                        className={`border-b border-outline-variant/5 ${i % 2 === 0 ? "" : "bg-surface-container-low/30"}`}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-on-surface">{preset.displayName}</div>
                          {preset.notes && (
                            <div className="mt-0.5 text-[11px] text-outline">{preset.notes}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-on-surface-variant font-mono">
                          {preset.targetWidth && preset.targetHeight
                            ? `${preset.targetWidth}x${preset.targetHeight}`
                            : "var"}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-outline font-mono">
                          {preset.openaiSize}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-outline">
                          ${preset.costs.low.toFixed(3)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-secondary">
                          ${preset.costs.medium.toFixed(3)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-primary">
                          ${preset.costs.high.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-outline-variant/20 bg-surface-container-low/50 font-semibold">
                      <td className="px-3 py-2 text-on-surface" colSpan={3}>Total (19 imagens)</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-outline">
                        ${data.totals.low.toFixed(3)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-secondary">
                        ${data.totals.medium.toFixed(3)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-primary">
                        ${data.totals.high.toFixed(3)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Notes */}
              <div className="space-y-1.5 rounded-lg bg-surface-container-low p-3">
                <div className="text-xs font-semibold text-on-surface-variant">Notas</div>
                {Object.entries(data.notes).map(([key, note]) => (
                  <p key={key} className="flex items-start gap-1.5 text-xs text-outline">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-outline/50" />
                    {note}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
