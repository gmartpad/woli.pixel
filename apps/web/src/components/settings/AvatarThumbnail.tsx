import { useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarThumbnailProps {
  id: string;
  url: string;
  isCurrent: boolean;
  isSelected: boolean;
  isMultiSelect: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AvatarThumbnail({
  id,
  url,
  isCurrent,
  isSelected,
  isMultiSelect,
  onSelect,
  onDelete,
}: AvatarThumbnailProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      className={cn(
        "relative h-16 w-16 rounded-full overflow-hidden transition-all",
        "ring-2 ring-offset-2 ring-offset-surface-container-low",
        isSelected
          ? "ring-primary"
          : isCurrent
            ? "ring-secondary"
            : "ring-transparent hover:ring-outline-variant/50",
      )}
      data-selected={isSelected || undefined}
      data-current={isCurrent || undefined}
      onClick={() => onSelect(id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={url} alt={`Avatar ${id}`} className="h-full w-full object-cover" />

      {hovered && !isMultiSelect && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Excluir avatar"
          className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-error text-white text-xs shadow-md hover:bg-error/80"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onDelete(id);
            }
          }}
        >
          &times;
        </span>
      )}

      {isMultiSelect && (
        <div className="absolute top-0.5 right-0.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-white accent-primary"
          />
        </div>
      )}
    </button>
  );
}
