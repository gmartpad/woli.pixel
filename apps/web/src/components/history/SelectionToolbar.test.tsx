import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SelectionToolbar } from "./SelectionToolbar";

describe("SelectionToolbar", () => {
  const defaultProps = {
    selectedCount: 3,
    totalCount: 10,
    onCancel: vi.fn(),
    onSelectAll: vi.fn(),
    onDelete: vi.fn(),
    onDownload: vi.fn(),
    isDeleting: false,
    isDownloading: false,
  };

  it("shows selected count", () => {
    render(<SelectionToolbar {...defaultProps} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/selecionados/)).toBeInTheDocument();
  });

  it("calls onCancel when close button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<SelectionToolbar {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByLabelText("Sair da seleção"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onSelectAll when select all button is clicked", async () => {
    const user = userEvent.setup();
    const onSelectAll = vi.fn();
    render(<SelectionToolbar {...defaultProps} onSelectAll={onSelectAll} />);
    await user.click(screen.getByText("Selecionar todos"));
    expect(onSelectAll).toHaveBeenCalledOnce();
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<SelectionToolbar {...defaultProps} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: /excluir/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("calls onDownload when download button is clicked", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(<SelectionToolbar {...defaultProps} onDownload={onDownload} />);
    await user.click(screen.getByRole("button", { name: /baixar/i }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("shows loading state when isDeleting is true", () => {
    render(<SelectionToolbar {...defaultProps} isDeleting={true} />);
    expect(screen.getByRole("button", { name: /excluindo/i })).toBeDisabled();
  });

  it("shows loading state when isDownloading is true", () => {
    render(<SelectionToolbar {...defaultProps} isDownloading={true} />);
    expect(screen.getByRole("button", { name: /baixando/i })).toBeDisabled();
  });

  it('shows "Desmarcar todos" when all are selected', () => {
    render(
      <SelectionToolbar
        {...defaultProps}
        selectedCount={10}
        totalCount={10}
      />,
    );
    expect(screen.getByText("Desmarcar todos")).toBeInTheDocument();
  });
});
