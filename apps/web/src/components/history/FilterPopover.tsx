import { useState } from "react";
import { cn } from "@/lib/utils";

import type { HistoryFilterState } from "@/hooks/useHistoryFilters";

type Props = {
  filters: HistoryFilterState;
  onApplyFilter: (key: string, value: string) => void;
  onToggleCategory: (cat: string) => void;
  onClose: () => void;
  initialFilterKey?: string;
};

type FilterOption = {
  value: string;
  label: string;
};

type FilterDef = {
  key: string;
  label: string;
  type: "single" | "multi";
  options: FilterOption[];
};

export const FILTER_DEFS: FilterDef[] = [
  {
    key: "mode",
    label: "Modo",
    type: "single",
    options: [
      { value: "generation", label: "Geracao" },
      { value: "upload", label: "Upload" },
    ],
  },
  {
    key: "categories",
    label: "Categoria",
    type: "multi",
    options: [
      { value: "admin", label: "Admin/Branding" },
      { value: "content", label: "Conteudo" },
      { value: "gamification", label: "Gamificacao" },
      { value: "user", label: "Usuario" },
    ],
  },
  {
    key: "model",
    label: "Modelo",
    type: "single",
    options: [
      { value: "recraft_v3", label: "Recraft V3" },
      { value: "flux_2_pro", label: "FLUX.2 Pro" },
    ],
  },
  {
    key: "quality",
    label: "Qualidade",
    type: "single",
    options: [
      { value: "low", label: "Baixa" },
      { value: "medium", label: "Media" },
      { value: "high", label: "Alta" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "single",
    options: [
      { value: "completed", label: "Sucesso" },
      { value: "error", label: "Erro" },
    ],
  },
];

function isFilterActive(filters: HistoryFilterState, key: string): boolean {
  switch (key) {
    case "mode":
      return filters.mode !== "all";
    case "status":
      return filters.status !== "all";
    case "model":
      return filters.model !== "";
    case "quality":
      return filters.quality !== "";
    case "categories":
      return filters.categories.length > 0;
    default:
      return false;
  }
}

function getSelectedValue(filters: HistoryFilterState, key: string): string {
  switch (key) {
    case "mode":
      return filters.mode;
    case "status":
      return filters.status;
    case "model":
      return filters.model;
    case "quality":
      return filters.quality;
    default:
      return "";
  }
}

export function FilterPopover({
  filters,
  onApplyFilter,
  onToggleCategory,
  onClose,
  initialFilterKey,
}: Props) {
  const initialDef = initialFilterKey
    ? FILTER_DEFS.find((d) => d.key === initialFilterKey) ?? null
    : null;
  const [activeFilter, setActiveFilter] = useState<FilterDef | null>(initialDef);

  if (activeFilter) {
    const selectedValue = getSelectedValue(filters, activeFilter.key);

    return (
      <div className="w-48 rounded-lg bg-surface-container border border-outline-variant/20 shadow-xl">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant/20">
          <button
            type="button"
            aria-label="Voltar para lista de filtros"
            onClick={() => setActiveFilter(null)}
            className="text-on-surface"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-sm font-medium text-on-surface">
            {activeFilter.label}
          </span>
        </div>

        <div className="py-1">
          {activeFilter.type === "single"
            ? activeFilter.options.map((option) => {
                const isSelected = selectedValue === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onApplyFilter(activeFilter.key, option.value);
                      onClose();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high transition-colors",
                      isSelected && "text-primary bg-primary/10",
                    )}
                  >
                    <span
                      className={cn(
                        "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-outline-variant",
                      )}
                    >
                      {isSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    {option.label}
                  </button>
                );
              })
            : activeFilter.options.map((option) => {
                const isChecked = filters.categories.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer",
                      isChecked && "text-primary bg-primary/10",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      aria-label={option.label}
                      onChange={() => onToggleCategory(option.value)}
                      className="accent-primary"
                    />
                    {option.label}
                  </label>
                );
              })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-48 rounded-lg bg-surface-container border border-outline-variant/20 shadow-xl">
      <div className="py-1">
        {FILTER_DEFS.map((def) => {
          const active = isFilterActive(filters, def.key);
          return (
            <button
              key={def.key}
              type="button"
              onClick={() => setActiveFilter(def)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span>{def.label}</span>
              {active && (
                <span
                  data-testid="active-indicator"
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
