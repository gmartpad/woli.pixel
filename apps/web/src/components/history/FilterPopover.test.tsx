import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FilterPopover } from "./FilterPopover";

import type { HistoryFilterState } from "@/hooks/useHistoryFilters";

const DEFAULT_FILTERS: HistoryFilterState = {
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

function renderPopover(overrides: Partial<HistoryFilterState> = {}, props = {}) {
  const filters = { ...DEFAULT_FILTERS, ...overrides };
  const defaultProps = {
    filters,
    onApplyFilter: vi.fn(),
    onToggleCategory: vi.fn(),
    onClose: vi.fn(),
    ...props,
  };
  return { ...render(<FilterPopover {...defaultProps} />), ...defaultProps };
}

describe("FilterPopover", () => {
  it("renders all 5 filter names in the list", () => {
    renderPopover();

    expect(screen.getByText("Modo")).toBeInTheDocument();
    expect(screen.getByText("Categoria")).toBeInTheDocument();
    expect(screen.getByText("Modelo")).toBeInTheDocument();
    expect(screen.getByText("Qualidade")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("shows value picker when a filter name is clicked", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByText("Modelo"));

    expect(screen.getByText("Recraft V3")).toBeInTheDocument();
    expect(screen.getByText("FLUX.2 Pro")).toBeInTheDocument();
  });

  it("navigates back to filter list with back button", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByText("Modelo"));
    expect(screen.queryByText("Modo")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Voltar para lista de filtros" }),
    );

    expect(screen.getByText("Modo")).toBeInTheDocument();
    expect(screen.getByText("Modelo")).toBeInTheDocument();
  });

  it("calls onApplyFilter for single-select and onClose", async () => {
    const user = userEvent.setup();
    const { onApplyFilter, onClose } = renderPopover();

    await user.click(screen.getByText("Modelo"));
    await user.click(screen.getByText("Recraft V3"));

    expect(onApplyFilter).toHaveBeenCalledWith("model", "recraft_v3");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onToggleCategory for multi-select without calling onClose", async () => {
    const user = userEvent.setup();
    const { onToggleCategory, onClose } = renderPopover();

    await user.click(screen.getByText("Categoria"));
    await user.click(screen.getByRole("checkbox", { name: "Conteudo" }));

    expect(onToggleCategory).toHaveBeenCalledWith("content");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows active indicator dot on already-active filters", () => {
    renderPopover({ model: "recraft_v3" });

    const indicators = screen.getAllByTestId("active-indicator");
    expect(indicators).toHaveLength(1);

    // The indicator should be within the Modelo row
    const modeloRow = screen.getByText("Modelo").closest("button");
    expect(modeloRow?.querySelector('[data-testid="active-indicator"]')).toBeTruthy();
  });

  it("shows checked state for active categories", async () => {
    const user = userEvent.setup();
    renderPopover({ categories: ["content"] });

    await user.click(screen.getByText("Categoria"));

    const checkbox = screen.getByRole("checkbox", {
      name: "Conteudo",
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});
