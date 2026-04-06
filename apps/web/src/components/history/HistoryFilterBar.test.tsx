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

function renderBar(
  overrides: Partial<{
    filters: Partial<HistoryFilterState>;
    activeFilterCount: number;
    setFilter: ReturnType<typeof vi.fn>;
    toggleCategory: ReturnType<typeof vi.fn>;
    setDateRange: ReturnType<typeof vi.fn>;
    clearAll: ReturnType<typeof vi.fn>;
  }> = {},
) {
  const props = {
    filters: { ...defaultFilters(), ...overrides.filters },
    activeFilterCount: overrides.activeFilterCount ?? 0,
    setFilter: overrides.setFilter ?? vi.fn(),
    toggleCategory: overrides.toggleCategory ?? vi.fn(),
    setDateRange: overrides.setDateRange ?? vi.fn(),
    clearAll: overrides.clearAll ?? vi.fn(),
  };

  return { ...render(<HistoryFilterBar {...props} />), ...props };
}

describe("HistoryFilterBar", () => {
  // ── Always-visible elements ─────────────────────
  it("renders search input with placeholder", () => {
    renderBar();

    expect(
      screen.getByPlaceholderText("Buscar por prompt ou arquivo..."),
    ).toBeInTheDocument();
  });

  it("renders date preset chips (Hoje, Esta Semana, Este Mes, Todos)", () => {
    renderBar();

    expect(screen.getByRole("button", { name: "Hoje" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Esta Semana" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Este M/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todos" })).toBeInTheDocument();
  });

  it("renders + Filtro button", () => {
    renderBar();

    expect(
      screen.getByRole("button", { name: /\+ Filtro/ }),
    ).toBeInTheDocument();
  });

  // ── No old dropdowns ────────────────────────────
  it("does not render dropdown selects", () => {
    renderBar();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("listbox"),
    ).not.toBeInTheDocument();
    // No <select> elements with old aria-labels
    const selects = document.querySelectorAll("select");
    expect(selects).toHaveLength(0);
  });

  // ── Popover ─────────────────────────────────────
  it("opens popover with filter names when + Filtro clicked", async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole("button", { name: /\+ Filtro/ }));

    expect(screen.getByText("Modo")).toBeInTheDocument();
    expect(screen.getByText("Categoria")).toBeInTheDocument();
    expect(screen.getByText("Modelo")).toBeInTheDocument();
    expect(screen.getByText("Qualidade")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("closes popover when clicking outside", async () => {
    const user = userEvent.setup();
    renderBar();

    // Open popover
    await user.click(screen.getByRole("button", { name: /\+ Filtro/ }));
    expect(screen.getByText("Modo")).toBeInTheDocument();

    // Click on the search input (outside the popover)
    await user.click(
      screen.getByPlaceholderText("Buscar por prompt ou arquivo..."),
    );

    expect(screen.queryByText("Modo")).not.toBeInTheDocument();
  });

  // ── Pills ───────────────────────────────────────
  it('shows pill when a filter is active (model: "recraft_v3")', () => {
    renderBar({
      filters: { model: "recraft_v3" },
      activeFilterCount: 1,
    });

    expect(screen.getByText("Modelo:")).toBeInTheDocument();
    expect(screen.getByText("Recraft V3")).toBeInTheDocument();
  });

  it("shows multiple pills for multiple active filters", () => {
    renderBar({
      filters: { model: "recraft_v3", status: "completed" },
      activeFilterCount: 2,
    });

    expect(screen.getByText("Modelo:")).toBeInTheDocument();
    expect(screen.getByText("Recraft V3")).toBeInTheDocument();
    expect(screen.getByText("Status:")).toBeInTheDocument();
    expect(screen.getByText("Sucesso")).toBeInTheDocument();
  });

  it("removes pill and resets filter when x clicked", async () => {
    const user = userEvent.setup();
    const setFilter = vi.fn();

    renderBar({
      filters: { model: "recraft_v3" },
      activeFilterCount: 1,
      setFilter,
    });

    await user.click(
      screen.getByRole("button", { name: "Remover filtro Modelo" }),
    );

    expect(setFilter).toHaveBeenCalledWith("model", "");
  });

  // ── Pill edit ───────────────────────────────────
  it("opens value picker when pill label clicked", async () => {
    const user = userEvent.setup();
    renderBar({
      filters: { model: "recraft_v3" },
      activeFilterCount: 1,
    });

    // Click the pill's edit area (the value text)
    await user.click(screen.getByText("Recraft V3"));

    // The popover should show the model value picker options
    expect(screen.getByText("FLUX.2 Pro")).toBeInTheDocument();
  });

  // ── Date presets ────────────────────────────────
  it('clicking Hoje calls setFilter with datePreset "today"', async () => {
    const user = userEvent.setup();
    const setFilter = vi.fn();

    renderBar({ setFilter });

    await user.click(screen.getByRole("button", { name: "Hoje" }));
    expect(setFilter).toHaveBeenCalledWith("datePreset", "today");
  });

  // ── Clear all ───────────────────────────────────
  it("shows Limpar when activeFilterCount > 0", () => {
    renderBar({
      filters: { mode: "generation" },
      activeFilterCount: 1,
    });

    expect(
      screen.getByRole("button", { name: "Limpar" }),
    ).toBeInTheDocument();
  });

  it("hides Limpar when activeFilterCount === 0", () => {
    renderBar();

    expect(
      screen.queryByRole("button", { name: "Limpar" }),
    ).not.toBeInTheDocument();
  });

  it("calls clearAll when Limpar clicked", async () => {
    const user = userEvent.setup();
    const clearAll = vi.fn();

    renderBar({
      filters: { mode: "generation" },
      activeFilterCount: 1,
      clearAll,
    });

    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(clearAll).toHaveBeenCalledOnce();
  });
});
