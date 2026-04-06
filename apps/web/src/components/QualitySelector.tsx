export type QualityTier = "low" | "medium" | "high";

type QualityOption = {
  tier: QualityTier;
  label: string;
  description: string;
};

const QUALITY_OPTIONS: QualityOption[] = [
  { tier: "low", label: "Rascunho", description: "Preview rápido" },
  { tier: "medium", label: "Padrão", description: "Uso geral" },
  { tier: "high", label: "Alta Qualidade", description: "Produção" },
];

type Props = {
  selectedTier: QualityTier;
  onSelect: (tier: QualityTier) => void;
  typeKey?: string | null;
  costs?: Record<QualityTier, number>;
  modelLabel?: string;
  note?: string | null;
};

export function QualitySelector({ selectedTier, onSelect, costs, modelLabel, note }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-on-surface">Qualidade da Geração</h4>
        {modelLabel && (
          <span className="text-xs text-outline">
            {modelLabel}
          </span>
        )}
      </div>

      <div className="flex gap-1 rounded-xl bg-surface-container-low p-1">
        {QUALITY_OPTIONS.map(({ tier, label, description }) => {
          const isSelected = selectedTier === tier;
          const cost = costs?.[tier];

          return (
            <button
              key={tier}
              onClick={() => onSelect(tier)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isSelected
                  ? "bg-surface-container-high text-primary shadow-lg"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
              }`}
            >
              <span className="font-semibold">{label}</span>
              <span className="text-[11px] text-outline">{description}</span>
              {cost != null && (
                <span className={`mt-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-mono ${
                  isSelected
                    ? "bg-primary/15 text-primary"
                    : "bg-surface-container-high/60 text-outline"
                }`}>
                  ${cost.toFixed(3)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {note && (
        <p className="flex items-start gap-1.5 text-xs text-on-surface-variant">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          {note}
        </p>
      )}
    </div>
  );
}
