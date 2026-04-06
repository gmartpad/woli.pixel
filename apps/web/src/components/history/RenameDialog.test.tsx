import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { RenameDialog } from "./RenameDialog";

// JSDOM does not implement HTMLDialogElement methods
beforeAll(() => {
  const dialogProto = document.createElement("dialog").constructor
    .prototype as HTMLDialogElement;
  dialogProto.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  dialogProto.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

describe("RenameDialog", () => {
  it("renders pre-filled input with currentName when open", () => {
    render(
      <RenameDialog
        open={true}
        currentName="Minha imagem"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isSaving={false}
      />,
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Minha imagem");
    expect(screen.getByText("Renomear imagem")).toBeInTheDocument();
  });

  it("Salvar button calls onConfirm with trimmed value", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <RenameDialog
        open={true}
        currentName="Foto"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isSaving={false}
      />,
    );

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "  Novo nome  ");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith("Novo nome");
  });

  it("Salvar button is disabled when input is empty or whitespace-only", async () => {
    const user = userEvent.setup();

    render(
      <RenameDialog
        open={true}
        currentName="Foto"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isSaving={false}
      />,
    );

    const input = screen.getByRole("textbox");
    await user.clear(input);

    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    await user.type(input, "   ");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("Cancelar button calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <RenameDialog
        open={true}
        currentName="Foto"
        onConfirm={vi.fn()}
        onCancel={onCancel}
        isSaving={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("Enter key submits and calls onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <RenameDialog
        open={true}
        currentName="Foto"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isSaving={false}
      />,
    );

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Nome atualizado{Enter}");

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith("Nome atualizado");
  });

  it("isSaving disables Salvar button and shows Salvando... text", () => {
    render(
      <RenameDialog
        open={true}
        currentName="Foto"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isSaving={true}
      />,
    );

    const saveButton = screen.getByRole("button", { name: /salvando/i });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveTextContent("Salvando...");
  });

  it("does not render content when open is false", () => {
    render(
      <RenameDialog
        open={false}
        currentName="Foto"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.queryByText("Renomear imagem")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
