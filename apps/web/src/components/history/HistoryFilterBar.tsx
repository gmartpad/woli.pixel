import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { FilterPill } from "./FilterPill";
import { FilterPopover, FILTER_DEFS } from "./FilterPopover";

import type { HistoryFilterState } from "@/hooks/useHistoryFilters";

type Props = {
  filters: HistoryFilterState;
  activeFilterCount: number;
  setFilter: <K extends keyof HistoryFilterState>(
    key: K,
    value: HistoryFilterState[K],
  ) => void;
  toggleCategory: (cat: string) => void;
  setDateRange: (from: string, to: string) => void;
  clearAll: () => void;
  onSearchPending?: (pending: boolean) => void;
};

const DATE_PRESETS = [
  { label: "Hoje", value: "today" },
  { label: "Esta Semana", value: "week" },
  { label: "Este Mês", value: "month" },
  { label: "Todos", value: "all" },
] as const;

const FILTER_DISPLAY: Record<
  string,
  {
    label: string;
    filterKey: keyof HistoryFilterState;
    defaultValue: string;
    valueLabels: Record<string, string>;
  }
> = {
  mode: {
    label: "Modo",
    filterKey: "mode",
    defaultValue: "all",
    valueLabels: { generation: "Geração", upload: "Upload" },
  },
  model: {
    label: "Modelo",
    filterKey: "model",
    defaultValue: "",
    valueLabels: { recraft_v3: "Recraft V3", flux_2_pro: "FLUX.2 Pro" },
  },
  quality: {
    label: "Qualidade",
    filterKey: "quality",
    defaultValue: "",
    valueLabels: { low: "Baixa", medium: "Média", high: "Alta" },
  },
  status: {
    label: "Status",
    filterKey: "status",
    defaultValue: "all",
    valueLabels: { completed: "Sucesso", error: "Erro" },
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  admin: "Admin/Branding",
  content: "Conteúdo",
  gamification: "Gamificação",
  user: "Usuário",
};

export function HistoryFilterBar({
  filters,
  activeFilterCount,
  setFilter,
  toggleCategory,
  setDateRange,
  clearAll,
  onSearchPending,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const [localSearch, setLocalSearch] = useState(filters.search);

  // Sync local search with external filter state (e.g. when clearAll is called)
  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverInitialFilter, setPopoverInitialFilter] = useState<
    string | undefined
  >(undefined);

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleSearchChange(value: string) {
    setLocalSearch(value);
    onSearchPending?.(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setFilter("search", value);
      onSearchPending?.(false);
    }, 600);
  }

  // Click-outside handling
  useEffect(() => {
    if (!popoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
        setPopoverInitialFilter(undefined);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popoverOpen]);

  // Build active pills
  const pills: {
    key: string;
    label: string;
    value: string;
    onRemove: () => void;
    editFilterKey: string;
  }[] = [];

  for (const [key, display] of Object.entries(FILTER_DISPLAY)) {
    const filterValue = filters[display.filterKey] as string;
    if (filterValue !== display.defaultValue) {
      const valueLabel =
        display.valueLabels[filterValue] ?? filterValue;
      pills.push({
        key,
        label: display.label,
        value: valueLabel,
        onRemove: () =>
          setFilter(
            display.filterKey,
            display.defaultValue as HistoryFilterState[typeof display.filterKey],
          ),
        editFilterKey: key,
      });
    }
  }

  // Categories pill
  if (filters.categories.length > 0) {
    const catValue = filters.categories
      .map((c) => CATEGORY_LABELS[c] ?? c)
      .join(", ");
    pills.push({
      key: "categories",
      label: "Categoria",
      value: catValue,
      onRemove: () => setFilter("categories", []),
      editFilterKey: "categories",
    });
  }

  function handlePillEdit(filterKey: string) {
    setPopoverInitialFilter(filterKey);
    setPopoverOpen(true);
  }

  function handlePopoverApply(key: string, value: string) {
    const display = FILTER_DISPLAY[key];
    if (display) {
      setFilter(
        display.filterKey,
        value as HistoryFilterState[typeof display.filterKey],
      );
    }
  }

  function handlePopoverClose() {
    setPopoverOpen(false);
    setPopoverInitialFilter(undefined);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search input */}
      <input
        type="text"
        value={localSearch}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Buscar por prompt ou arquivo..."
        className={cn(
          "rounded-lg bg-surface-container-low border border-outline-variant/20",
          "px-3 py-2 text-sm text-on-surface",
          "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
          "min-w-[200px] flex-1 max-w-xs",
        )}
      />

      {/* Filter pills */}
      {pills.map((pill) => (
        <FilterPill
          key={pill.key}
          label={pill.label}
          value={pill.value}
          onEdit={() => handlePillEdit(pill.editFilterKey)}
          onRemove={pill.onRemove}
        />
      ))}

      {/* Date preset chips */}
      {DATE_PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => setFilter("datePreset", preset.value)}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            filters.datePreset === preset.value
              ? "bg-primary text-on-primary"
              : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
          )}
        >
          {preset.label}
        </button>
      ))}

      {/* + Filtro button with popover */}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setPopoverInitialFilter(undefined);
            setPopoverOpen((prev) => !prev);
          }}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
            "border border-outline-variant/20",
          )}
        >
          + Filtro
        </button>

        {popoverOpen && (
          <div
            ref={popoverRef}
            className="absolute top-full right-0 mt-1 z-50"
          >
            <FilterPopover
              filters={filters}
              onApplyFilter={handlePopoverApply}
              onToggleCategory={toggleCategory}
              onClose={handlePopoverClose}
              initialFilterKey={popoverInitialFilter}
            />
          </div>
        )}
      </div>

      {/* Limpar button */}
      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-low px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            <line x1="18" y1="18" x2="22" y2="22" />
          </svg>
          Limpar
        </button>
      )}
    </div>
  );
}
