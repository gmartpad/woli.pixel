import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

// JSDOM does not implement HTMLDialogElement methods
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.removeAttribute("open");
  });
});

describe("DeleteConfirmDialog", () => {
  it("renders confirmation message with item name when open", () => {
    render(
      <DeleteConfirmDialog
        open={true}
        itemName="Favicon"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isDeleting={false}
      />,
    );

    expect(
      screen.getByText(/Tem certeza que deseja excluir/),
    ).toBeInTheDocument();
    expect(screen.getByText("Favicon")).toBeInTheDocument();
    expect(
      screen.getByText("Esta ação não pode ser desfeita."),
    ).toBeInTheDocument();
  });

  it('calls onConfirm when "Excluir" button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <DeleteConfirmDialog
        open={true}
        itemName="Favicon"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isDeleting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when "Cancelar" button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <DeleteConfirmDialog
        open={true}
        itemName="Favicon"
        onConfirm={vi.fn()}
        onCancel={onCancel}
        isDeleting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows loading state when isDeleting is true", () => {
    render(
      <DeleteConfirmDialog
        open={true}
        itemName="Favicon"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isDeleting={true}
      />,
    );

    const deleteButton = screen.getByRole("button", {
      name: /excluindo/i,
    });
    expect(deleteButton).toBeDisabled();
  });

  it("does not render content when open is false", () => {
    render(
      <DeleteConfirmDialog
        open={false}
        itemName="Favicon"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isDeleting={false}
      />,
    );

    expect(
      screen.queryByText(/Tem certeza que deseja excluir/),
    ).not.toBeInTheDocument();
  });

  it("shows plural message when itemCount is provided and > 1", () => {
    render(
      <DeleteConfirmDialog
        open={true}
        itemName=""
        itemCount={5}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isDeleting={false}
      />,
    );

    expect(screen.getByText(/5 imagens/)).toBeInTheDocument();
  });
});
