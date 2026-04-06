type StyleOption = {
  value: string;
  label: string;
  subtitle: string;
};

const STYLE_OPTIONS: StyleOption[] = [
  { value: "auto", label: "Automático", subtitle: "Seleção automática" },
  { value: "illustration", label: "Ilustração", subtitle: "Recraft V3" },
  { value: "photorealistic", label: "Fotorrealista", subtitle: "FLUX.2 Pro" },
  { value: "logo", label: "Logo", subtitle: "Recraft V3" },
];

type Props = {
  selected: string;
  onSelect: (style: string) => void;
};

export function StyleSelector({ selected, onSelect }: Props) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-on-surface">Estilo de Geração</h4>

      <div className="flex gap-1 rounded-xl bg-surface-container-low p-1">
        {STYLE_OPTIONS.map(({ value, label, subtitle }) => {
          const isSelected = selected === value;

          return (
            <button
              key={value}
              onClick={() => onSelect(value)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                isSelected
                  ? "border-primary bg-surface-container-high text-primary shadow-lg"
                  : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
              }`}
            >
              <span className="font-semibold">{label}</span>
              <span className="text-[11px] text-outline">{subtitle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
