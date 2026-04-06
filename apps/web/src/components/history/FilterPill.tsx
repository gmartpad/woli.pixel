import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  onEdit: () => void;
  onRemove: () => void;
};

function formatValue(value: string): string {
  const parts = value.split(", ");
  if (parts.length > 1 && value.length > 30) {
    return `${parts.length} selecionadas`;
  }
  return value;
}

export function FilterPill({ label, value, onEdit, onRemove }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        "rounded-full bg-primary/15 border border-primary/30",
        "text-primary text-sm font-medium",
        "pl-3 pr-1 py-1",
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1"
      >
        <span className="text-primary/85">{label}:</span>
        <span>{formatValue(value)}</span>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remover filtro ${label}`}
        className={cn(
          "rounded-full p-0.5",
          "hover:bg-primary/20",
          "inline-flex items-center justify-center",
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </span>
  );
}
