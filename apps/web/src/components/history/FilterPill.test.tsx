import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FilterPill } from "./FilterPill";

describe("FilterPill", () => {
  it("renders label and value text", () => {
    render(
      <FilterPill
        label="Categoria"
        value="Branding"
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("Categoria:")).toBeInTheDocument();
    expect(screen.getByText("Branding")).toBeInTheDocument();
  });

  it("calls onEdit when label area is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <FilterPill
        label="Modo"
        value="Geração"
        onEdit={onEdit}
        onRemove={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Geração"));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("calls onRemove when close button is clicked without triggering onEdit", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onRemove = vi.fn();

    render(
      <FilterPill
        label="Status"
        value="Concluído"
        onEdit={onEdit}
        onRemove={onRemove}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Remover filtro Status" }),
    );
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('truncates long multi-select values with count ("3 selecionadas")', () => {
    render(
      <FilterPill
        label="Categoria"
        value="Branding, Conteúdo, Gamificação"
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("3 selecionadas")).toBeInTheDocument();
    expect(
      screen.queryByText("Branding, Conteúdo, Gamificação"),
    ).not.toBeInTheDocument();
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
