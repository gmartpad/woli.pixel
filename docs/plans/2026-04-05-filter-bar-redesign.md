# Filter Bar Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current 3-row filter bar (4 unlabeled dropdowns + date pickers + category chips) with a Linear-style filter pill bar — one clean row with search + date presets + "+ Filtro" button, and active filters shown as clickable/removable pills.

**Architecture:** Three new/rewritten components (`FilterPill`, `FilterPopover`, `HistoryFilterBar`) with the existing `useHistoryFilters` hook unchanged. The pill pattern uses a two-state popover (filter list → value picker) and inline pill editing.

**Tech Stack:** React 19 + TailwindCSS 4 + Vitest + React Testing Library

**Design doc:** `docs/plans/2026-04-05-filter-bar-redesign-design.md`

---

## Task 1: FilterPill Component

**Files:**
- Create: `apps/web/src/components/history/FilterPill.tsx`
- Create: `apps/web/src/components/history/FilterPill.test.tsx`

### Step 1: Write the failing tests

```tsx
// apps/web/src/components/history/FilterPill.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FilterPill } from "./FilterPill";

describe("FilterPill", () => {
  const defaultProps = {
    label: "Modelo",
    value: "Recraft V3",
    onEdit: vi.fn(),
    onRemove: vi.fn(),
  };

  it("renders label and value", () => {
    render(<FilterPill {...defaultProps} />);
    expect(screen.getByText("Modelo:")).toBeInTheDocument();
    expect(screen.getByText("Recraft V3")).toBeInTheDocument();
  });

  it("calls onEdit when label area is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<FilterPill {...defaultProps} onEdit={onEdit} />);
    await user.click(screen.getByText("Recraft V3"));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("calls onRemove when ✕ button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<FilterPill {...defaultProps} onRemove={onRemove} />);
    await user.click(screen.getByRole("button", { name: /remover/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("truncates long multi-select values with count", () => {
    render(
      <FilterPill
        label="Categoria"
        value="Admin/Branding, Conteúdo, Gamificação"
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    // Value exceeds 30 chars, should show count
    expect(screen.getByText(/3 selecionadas/)).toBeInTheDocument();
  });

  it("shows short multi-select values inline", () => {
    render(
      <FilterPill
        label="Categoria"
        value="Branding, Conteúdo"
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("Branding, Conteúdo")).toBeInTheDocument();
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd apps/web && bunx vitest run src/components/history/FilterPill.test.tsx`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

```tsx
// apps/web/src/components/history/FilterPill.tsx
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
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 pl-3 pr-1 py-1 text-sm font-medium text-primary">
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center gap-1 hover:text-primary/80 transition-colors"
      >
        <span className="text-primary/70">{label}:</span>
        <span>{formatValue(value)}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remover filtro ${label}`}
        className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
```

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/components/history/FilterPill.test.tsx`
Expected: PASS (5 tests)

---

## Task 2: FilterPopover Component

**Files:**
- Create: `apps/web/src/components/history/FilterPopover.tsx`
- Create: `apps/web/src/components/history/FilterPopover.test.tsx`

### Step 1: Write the failing tests

```tsx
// apps/web/src/components/history/FilterPopover.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FilterPopover } from "./FilterPopover";
import type { HistoryFilterState } from "@/hooks/useHistoryFilters";

function defaultFilters(): HistoryFilterState {
  return {
    mode: "all",
    status: "all",
    categories: [],
    model: "",
    quality: "",
    search: "",
    datePreset: "all",
    dateFrom: "",
    dateTo: "",
  };
}

describe("FilterPopover", () => {
  const defaultProps = {
    filters: defaultFilters(),
    onApplyFilter: vi.fn(),
    onToggleCategory: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders all 5 filter names in the list", () => {
    render(<FilterPopover {...defaultProps} />);
    expect(screen.getByText("Modo")).toBeInTheDocument();
    expect(screen.getByText("Categoria")).toBeInTheDocument();
    expect(screen.getByText("Modelo")).toBeInTheDocument();
    expect(screen.getByText("Qualidade")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("shows value picker when a filter name is clicked", async () => {
    const user = userEvent.setup();
    render(<FilterPopover {...defaultProps} />);
    await user.click(screen.getByText("Modelo"));
    // Should show values
    expect(screen.getByText("Recraft V3")).toBeInTheDocument();
    expect(screen.getByText("FLUX.2 Pro")).toBeInTheDocument();
    // Should show back button with filter name
    expect(screen.getByText(/Modelo/)).toBeInTheDocument();
  });

  it("navigates back to filter list with back button", async () => {
    const user = userEvent.setup();
    render(<FilterPopover {...defaultProps} />);
    await user.click(screen.getByText("Modelo"));
    // Click back
    await user.click(screen.getByRole("button", { name: /voltar/i }));
    // Should show filter list again
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("calls onApplyFilter for single-select and closes", async () => {
    const user = userEvent.setup();
    const onApplyFilter = vi.fn();
    const onClose = vi.fn();
    render(<FilterPopover {...defaultProps} onApplyFilter={onApplyFilter} onClose={onClose} />);
    await user.click(screen.getByText("Modelo"));
    await user.click(screen.getByText("Recraft V3"));
    expect(onApplyFilter).toHaveBeenCalledWith("model", "recraft_v3");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onToggleCategory for multi-select without closing", async () => {
    const user = userEvent.setup();
    const onToggleCategory = vi.fn();
    const onClose = vi.fn();
    render(<FilterPopover {...defaultProps} onToggleCategory={onToggleCategory} onClose={onClose} />);
    await user.click(screen.getByText("Categoria"));
    await user.click(screen.getByText("Conteúdo"));
    expect(onToggleCategory).toHaveBeenCalledWith("content");
    expect(onClose).not.toHaveBeenCalled(); // stays open for multi-select
  });

  it("shows checkmark on already-active filters", () => {
    const filters = { ...defaultFilters(), model: "recraft_v3" };
    render(<FilterPopover {...defaultProps} filters={filters} />);
    // The "Modelo" row should have an active indicator
    const modelRow = screen.getByText("Modelo").closest("button");
    expect(modelRow?.querySelector("[data-testid='active-indicator']")).toBeInTheDocument();
  });

  it("shows checked state for active categories", async () => {
    const user = userEvent.setup();
    const filters = { ...defaultFilters(), categories: ["content"] };
    render(<FilterPopover {...defaultProps} filters={filters} />);
    await user.click(screen.getByText("Categoria"));
    // "Conteúdo" should appear checked
    const checkbox = screen.getByRole("checkbox", { name: "Conteúdo" });
    expect(checkbox).toBeChecked();
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd apps/web && bunx vitest run src/components/history/FilterPopover.test.tsx`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

```tsx
// apps/web/src/components/history/FilterPopover.tsx
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HistoryFilterState } from "@/hooks/useHistoryFilters";

type Props = {
  filters: HistoryFilterState;
  onApplyFilter: (key: string, value: string) => void;
  onToggleCategory: (cat: string) => void;
  onClose: () => void;
};

type FilterDef = {
  key: string;
  label: string;
  type: "single" | "multi";
  options: { value: string; label: string }[];
  activeValue: (filters: HistoryFilterState) => string | string[];
  defaultValue: string | string[];
};

const FILTER_DEFS: FilterDef[] = [
  {
    key: "mode",
    label: "Modo",
    type: "single",
    options: [
      { value: "generation", label: "Geração" },
      { value: "upload", label: "Upload" },
    ],
    activeValue: (f) => f.mode,
    defaultValue: "all",
  },
  {
    key: "categories",
    label: "Categoria",
    type: "multi",
    options: [
      { value: "admin", label: "Admin/Branding" },
      { value: "content", label: "Conteúdo" },
      { value: "gamification", label: "Gamificação" },
      { value: "user", label: "Usuário" },
    ],
    activeValue: (f) => f.categories,
    defaultValue: [],
  },
  {
    key: "model",
    label: "Modelo",
    type: "single",
    options: [
      { value: "recraft_v3", label: "Recraft V3" },
      { value: "flux_2_pro", label: "FLUX.2 Pro" },
    ],
    activeValue: (f) => f.model,
    defaultValue: "",
  },
  {
    key: "quality",
    label: "Qualidade",
    type: "single",
    options: [
      { value: "low", label: "Baixa" },
      { value: "medium", label: "Média" },
      { value: "high", label: "Alta" },
    ],
    activeValue: (f) => f.quality,
    defaultValue: "",
  },
  {
    key: "status",
    label: "Status",
    type: "single",
    options: [
      { value: "completed", label: "Sucesso" },
      { value: "error", label: "Erro" },
    ],
    activeValue: (f) => f.status,
    defaultValue: "all",
  },
];

function isActive(def: FilterDef, filters: HistoryFilterState): boolean {
  const val = def.activeValue(filters);
  if (Array.isArray(val)) return val.length > 0;
  return val !== def.defaultValue;
}

export function FilterPopover({ filters, onApplyFilter, onToggleCategory, onClose }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterDef | null>(null);

  // State 1: Filter list
  if (!activeFilter) {
    return (
      <div className="w-48 rounded-lg bg-surface-container border border-outline-variant/20 py-1 shadow-xl">
        {FILTER_DEFS.map((def) => (
          <button
            key={def.key}
            type="button"
            onClick={() => setActiveFilter(def)}
            className="flex w-full items-center justify-between px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span>{def.label}</span>
            {isActive(def, filters) && (
              <span data-testid="active-indicator" className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>
    );
  }

  // State 2: Value picker
  const currentValue = activeFilter.activeValue(filters);

  return (
    <div className="w-48 rounded-lg bg-surface-container border border-outline-variant/20 shadow-xl">
      {/* Header with back button */}
      <button
        type="button"
        aria-label="Voltar para lista de filtros"
        onClick={() => setActiveFilter(null)}
        className="flex w-full items-center gap-2 border-b border-outline-variant/20 px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {activeFilter.label}
      </button>

      {/* Options */}
      <div className="py-1">
        {activeFilter.options.map((opt) => {
          if (activeFilter.type === "multi") {
            const isChecked = Array.isArray(currentValue) && currentValue.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <input
                  type="checkbox"
                  aria-label={opt.label}
                  checked={isChecked}
                  onChange={() => onToggleCategory(opt.value)}
                  className="rounded border-outline-variant text-primary focus:ring-primary"
                />
                {opt.label}
              </label>
            );
          }

          const isSelected = currentValue === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onApplyFilter(activeFilter.key, opt.value);
                onClose();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                isSelected
                  ? "text-primary bg-primary/10"
                  : "text-on-surface hover:bg-surface-container-high",
              )}
            >
              <span className={cn(
                "h-3.5 w-3.5 rounded-full border",
                isSelected ? "border-primary bg-primary" : "border-outline-variant",
              )} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/components/history/FilterPopover.test.tsx`
Expected: PASS (7 tests)

---

## Task 3: Rewrite HistoryFilterBar

**Files:**
- Rewrite: `apps/web/src/components/history/HistoryFilterBar.tsx`
- Rewrite: `apps/web/src/components/history/HistoryFilterBar.test.tsx`

### Step 1: Write the failing tests

```tsx
// apps/web/src/components/history/HistoryFilterBar.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryFilterBar } from "./HistoryFilterBar";
import type { HistoryFilterState } from "@/hooks/useHistoryFilters";

function defaultFilters(): HistoryFilterState {
  return {
    mode: "all",
    status: "all",
    categories: [],
    model: "",
    quality: "",
    search: "",
    datePreset: "all",
    dateFrom: "",
    dateTo: "",
  };
}

const noop = vi.fn();

function renderBar(overrides: Partial<{
  filters: HistoryFilterState;
  activeFilterCount: number;
  setFilter: typeof noop;
  toggleCategory: typeof noop;
  setDateRange: typeof noop;
  clearAll: typeof noop;
}> = {}) {
  return render(
    <HistoryFilterBar
      filters={overrides.filters ?? defaultFilters()}
      activeFilterCount={overrides.activeFilterCount ?? 0}
      setFilter={overrides.setFilter ?? noop}
      toggleCategory={overrides.toggleCategory ?? noop}
      setDateRange={overrides.setDateRange ?? noop}
      clearAll={overrides.clearAll ?? noop}
    />,
  );
}

describe("HistoryFilterBar", () => {
  // --- Always-visible elements ---
  it("renders search input", () => {
    renderBar();
    expect(screen.getByPlaceholderText("Buscar por prompt ou arquivo...")).toBeInTheDocument();
  });

  it("renders date preset chips", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Hoje" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esta Semana" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Este M/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todos" })).toBeInTheDocument();
  });

  it("renders + Filtro button", () => {
    renderBar();
    expect(screen.getByRole("button", { name: /filtro/i })).toBeInTheDocument();
  });

  // --- No dropdowns visible by default ---
  it("does not render dropdown selects", () => {
    renderBar();
    expect(screen.queryByLabelText("Modo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Modelo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Qualidade")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  // --- Popover ---
  it("opens popover with filter names when + Filtro is clicked", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole("button", { name: /filtro/i }));
    expect(screen.getByText("Modo")).toBeInTheDocument();
    expect(screen.getByText("Categoria")).toBeInTheDocument();
    expect(screen.getByText("Modelo")).toBeInTheDocument();
    expect(screen.getByText("Qualidade")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("closes popover when clicking outside", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole("button", { name: /filtro/i }));
    expect(screen.getByText("Modo")).toBeInTheDocument();
    // Click outside (the search input)
    await user.click(screen.getByPlaceholderText("Buscar por prompt ou arquivo..."));
    expect(screen.queryByText("Modo")).not.toBeInTheDocument();
  });

  // --- Pills ---
  it("shows pill when a filter is active", () => {
    renderBar({
      filters: { ...defaultFilters(), model: "recraft_v3" },
      activeFilterCount: 1,
    });
    expect(screen.getByText("Modelo:")).toBeInTheDocument();
    expect(screen.getByText("Recraft V3")).toBeInTheDocument();
  });

  it("shows multiple pills for multiple active filters", () => {
    renderBar({
      filters: { ...defaultFilters(), model: "recraft_v3", status: "completed" },
      activeFilterCount: 2,
    });
    expect(screen.getByText("Modelo:")).toBeInTheDocument();
    expect(screen.getByText("Status:")).toBeInTheDocument();
  });

  it("removes pill and resets filter when ✕ is clicked", async () => {
    const user = userEvent.setup();
    const setFilter = vi.fn();
    renderBar({
      filters: { ...defaultFilters(), model: "recraft_v3" },
      activeFilterCount: 1,
      setFilter,
    });
    await user.click(screen.getByRole("button", { name: /remover filtro modelo/i }));
    expect(setFilter).toHaveBeenCalledWith("model", "");
  });

  // --- Pill click-to-edit ---
  it("opens value picker when pill label is clicked", async () => {
    const user = userEvent.setup();
    renderBar({
      filters: { ...defaultFilters(), model: "recraft_v3" },
      activeFilterCount: 1,
    });
    await user.click(screen.getByText("Recraft V3"));
    // Value picker should show model options
    expect(screen.getByText("FLUX.2 Pro")).toBeInTheDocument();
  });

  // --- Date presets ---
  it("clicking Hoje calls setFilter with datePreset today", async () => {
    const user = userEvent.setup();
    const setFilter = vi.fn();
    renderBar({ setFilter });
    await user.click(screen.getByRole("button", { name: "Hoje" }));
    expect(setFilter).toHaveBeenCalledWith("datePreset", "today");
  });

  // --- Clear all ---
  it("shows Limpar when filters are active", () => {
    renderBar({
      filters: { ...defaultFilters(), model: "recraft_v3" },
      activeFilterCount: 1,
    });
    expect(screen.getByRole("button", { name: /limpar/i })).toBeInTheDocument();
  });

  it("hides Limpar when no filters active", () => {
    renderBar();
    expect(screen.queryByRole("button", { name: /limpar/i })).not.toBeInTheDocument();
  });

  it("calls clearAll when Limpar is clicked", async () => {
    const user = userEvent.setup();
    const clearAll = vi.fn();
    renderBar({
      filters: { ...defaultFilters(), model: "recraft_v3" },
      activeFilterCount: 1,
      clearAll,
    });
    await user.click(screen.getByRole("button", { name: /limpar/i }));
    expect(clearAll).toHaveBeenCalledOnce();
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd apps/web && bunx vitest run src/components/history/HistoryFilterBar.test.tsx`
Expected: FAIL — old component doesn't match new test expectations

### Step 3: Rewrite the component

The new `HistoryFilterBar` should:

1. **Search input** — debounced 300ms, same as before
2. **Active filter pills** — derived from `filters` state. For each non-default filter, render a `FilterPill` with:
   - `label`: display name (Modo, Modelo, etc.)
   - `value`: display value (Recraft V3, Sucesso, etc.) — map internal values to display labels
   - `onEdit`: opens a value picker popover anchored to the pill
   - `onRemove`: calls `setFilter(key, defaultValue)` to reset that filter
3. **Date preset chips** — same as current, radio-style
4. **"+ Filtro" button** — toggles `FilterPopover` visibility
5. **"Limpar" button** — calls `clearAll`, visible when `activeFilterCount > 0`
6. **Popover state management** — `useState` for popover open/closed, positioned with `absolute` relative to the button
7. **Click-outside handling** — `useEffect` with document click listener to close popover
8. **Pill edit popover** — separate popover state for when a pill's label is clicked, anchored to that pill

Key mapping from filter state to pill display values:

```ts
const FILTER_DISPLAY: Record<string, {
  label: string;
  defaultValue: string | string[];
  valueLabels: Record<string, string>;
}> = {
  mode: {
    label: "Modo",
    defaultValue: "all",
    valueLabels: { generation: "Geração", upload: "Upload" },
  },
  model: {
    label: "Modelo",
    defaultValue: "",
    valueLabels: { recraft_v3: "Recraft V3", flux_2_pro: "FLUX.2 Pro" },
  },
  quality: {
    label: "Qualidade",
    defaultValue: "",
    valueLabels: { low: "Baixa", medium: "Média", high: "Alta" },
  },
  status: {
    label: "Status",
    defaultValue: "all",
    valueLabels: { completed: "Sucesso", error: "Erro" },
  },
};
```

For categories (multi-select), the pill value is the comma-joined display labels of selected categories.

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/components/history/HistoryFilterBar.test.tsx`
Expected: PASS (14 tests)

### Step 5: Run all tests

Run: `cd apps/web && bunx vitest run`
Expected: All PASS (verify no regressions in HistoryPage tests that render HistoryFilterBar)

---

## Task 4: Update HistoryPage Mock (if needed)

**Files:**
- Modify: `apps/web/src/components/history/HistoryPage.test.tsx` (if the FilterBar mock needs updating)

The `HistoryPage.test.tsx` already mocks `HistoryFilterBar` as a stub (`<div data-testid="filter-bar" />`), so it should be unaffected. But verify by running:

Run: `cd apps/web && bunx vitest run src/components/history/HistoryPage.test.tsx`
Expected: PASS

If any test breaks due to changed exports, update the mock.

---

## Final Verification

```bash
cd apps/web && bunx vitest run
```

All tests should pass. Then manual testing:
1. Open Histórico page
2. Verify: only search + date presets + "+ Filtro" button visible (no dropdowns)
3. Click "+ Filtro" → popover shows 5 filter names
4. Click "Modelo" → shows Recraft V3 / FLUX.2 Pro options
5. Click "Recraft V3" → popover closes, pill "Modelo: Recraft V3 ✕" appears
6. Click pill label → value picker reopens anchored to pill
7. Click ✕ → pill removed, filter reset
8. Add multiple filters → multiple pills appear
9. Click "Limpar" → all pills removed
10. Verify date preset chips still work (Hoje/Semana/Mês/Todos)
11. Verify search still works with debounce

## File Index

| File | Action |
|---|---|
| `apps/web/src/components/history/FilterPill.tsx` | Create |
| `apps/web/src/components/history/FilterPill.test.tsx` | Create |
| `apps/web/src/components/history/FilterPopover.tsx` | Create |
| `apps/web/src/components/history/FilterPopover.test.tsx` | Create |
| `apps/web/src/components/history/HistoryFilterBar.tsx` | Rewrite |
| `apps/web/src/components/history/HistoryFilterBar.test.tsx` | Rewrite |
| `apps/web/src/hooks/useHistoryFilters.ts` | No changes |
