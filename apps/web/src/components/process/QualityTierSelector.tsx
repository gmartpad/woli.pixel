export type QualityTier = "low" | "medium" | "high";

const QUALITY_OPTIONS: { tier: QualityTier; label: string; description: string }[] = [
  { tier: "low", label: "Rascunho", description: "Preview rápido" },
  { tier: "medium", label: "Padrão", description: "Uso geral" },
  { tier: "high", label: "Alta Qualidade", description: "Produção" },
];

type Props = {
  selectedTier: QualityTier;
  onSelectTier: (tier: QualityTier) => void;
};

export function QualityTierSelector({ selectedTier, onSelectTier }: Props) {
  return (
    <div className="glass-card rounded-xl p-6 space-y-3">
      <h4 className="text-sm font-semibold text-on-surface">
        Qualidade do Processamento
      </h4>

      <div className="flex gap-1 rounded-xl bg-surface-container-low p-1">
        {QUALITY_OPTIONS.map(({ tier, label, description }) => {
          const isSelected = selectedTier === tier;

          return (
            <button
              key={tier}
              onClick={() => onSelectTier(tier)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isSelected
                  ? "bg-surface-container-high text-primary shadow-lg"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
              }`}
            >
              <span className="font-semibold">{label}</span>
              <span className="text-[11px] text-outline">{description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
