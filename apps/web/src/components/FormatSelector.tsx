import { cn } from "@/lib/utils";

const FORMATS = [
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
] as const;

type FormatValue = (typeof FORMATS)[number]["value"];

interface FormatSelectorProps {
  selected: string;
  onChange: (format: FormatValue) => void;
}

export function FormatSelector({ selected, onChange }: FormatSelectorProps) {
  const normalizedSelected = selected === "jpg" ? "jpeg" : selected;

  return (
    <div
      className="flex gap-1 rounded-lg bg-surface-container-low p-1"
      role="group"
      aria-label="Formato de download"
    >
      {FORMATS.map((fmt) => (
        <button
          key={fmt.value}
          onClick={() => onChange(fmt.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
            normalizedSelected === fmt.value
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high",
          )}
        >
          {fmt.label}
        </button>
      ))}
    </div>
  );
}
