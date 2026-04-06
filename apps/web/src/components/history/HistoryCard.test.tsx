import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryCard } from "./HistoryCard";
import type { HistoryItem } from "@/lib/api";

function createMockItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: "item-1",
    mode: "generation",
    status: "completed",
    createdAt: "2026-04-05T14:30:00Z",
    thumbnailUrl: "/api/v1/images/thumb/item-1.webp",
    downloadUrl: "/api/v1/images/download/item-1.png",
    category: "branding",
    imageTypeName: "Favicon",
    displayName: null,
    finalWidth: 128,
    finalHeight: 128,
    finalFormat: "PNG",
    finalSizeKb: 12,
    prompt: "A pixel art favicon",
    enhancedPrompt: null,
    model: "gpt-image-1-mini",
    qualityTier: "medium",
    costUsd: 0.011,
    originalFilename: null,
    originalWidth: null,
    originalHeight: null,
    originalSizeKb: null,
    aiQualityScore: null,
    ...overrides,
  };
}

describe("HistoryCard", () => {
  it("renders image type name and metadata", () => {
    const item = createMockItem();
    render(<HistoryCard item={item} isSelected={false} onClick={vi.fn()} />);

    expect(screen.getByText("Favicon")).toBeInTheDocument();
    expect(screen.getByText(/128×128/)).toBeInTheDocument();
    expect(screen.getByText(/PNG/)).toBeInTheDocument();
  });

  it('shows mode badge text "Geração" for generation mode', () => {
    const item = createMockItem({ mode: "generation" });
    render(<HistoryCard item={item} isSelected={false} onClick={vi.fn()} />);

    expect(screen.getByText("Geração")).toBeInTheDocument();
  });

  it('shows mode badge text "Upload" for upload mode', () => {
    const item = createMockItem({ mode: "upload" });
    render(<HistoryCard item={item} isSelected={false} onClick={vi.fn()} />);

    expect(screen.getByText("Upload")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const item = createMockItem();

    render(<HistoryCard item={item} isSelected={false} onClick={onClick} />);

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows selected state with border-primary class", () => {
    const item = createMockItem();
    render(<HistoryCard item={item} isSelected={true} onClick={vi.fn()} />);

    const button = screen.getByRole("button");
    expect(button.className).toContain("border-primary");
  });

  it("shows error status badge for error items", () => {
    const item = createMockItem({ status: "error" });
    render(<HistoryCard item={item} isSelected={false} onClick={vi.fn()} />);

    const badge = screen.getByTestId("status-badge");
    expect(badge.className).toContain("bg-red-400");
  });

  it("shows completed status badge for completed items", () => {
    const item = createMockItem({ status: "completed" });
    render(<HistoryCard item={item} isSelected={false} onClick={vi.fn()} />);

    const badge = screen.getByTestId("status-badge");
    expect(badge.className).toContain("bg-emerald-400");
  });

  it("falls back to originalFilename when imageTypeName is null", () => {
    const item = createMockItem({
      imageTypeName: null,
      originalFilename: "photo.jpg",
    });
    render(<HistoryCard item={item} isSelected={false} onClick={vi.fn()} />);

    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
  });

  it('falls back to "Personalizado" when both imageTypeName and originalFilename are null', () => {
    const item = createMockItem({
      imageTypeName: null,
      originalFilename: null,
    });
    render(<HistoryCard item={item} isSelected={false} onClick={vi.fn()} />);

    expect(screen.getByText("Personalizado")).toBeInTheDocument();
  });

  // ── Action menu tests ─────────────────────

  it("renders action menu button when onDelete is provided", () => {
    const item = createMockItem();
    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Ações")).toBeInTheDocument();
  });

  it("opens menu with Download and Excluir options when clicked", async () => {
    const user = userEvent.setup();
    const item = createMockItem();
    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Ações"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /download/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /excluir/i }),
    ).toBeInTheDocument();
  });

  it("calls onDelete with the item when Excluir option is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const item = createMockItem();

    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByLabelText("Ações"));
    await user.click(screen.getByRole("menuitem", { name: /excluir/i }));
    expect(onDelete).toHaveBeenCalledWith(item);
  });

  it("action menu interactions do NOT trigger the card onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const item = createMockItem();

    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={onClick}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Ações"));
    await user.click(screen.getByRole("menuitem", { name: /excluir/i }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("action menu button is not rendered when onDelete is omitted", () => {
    const item = createMockItem();
    render(<HistoryCard item={item} isSelected={false} onClick={vi.fn()} />);

    expect(screen.queryByLabelText("Ações")).not.toBeInTheDocument();
  });

  it("Download menu item has download attribute and href", async () => {
    const user = userEvent.setup();
    const item = createMockItem();
    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Ações"));
    const downloadLink = screen.getByRole("menuitem", { name: /download/i });
    expect(downloadLink).toHaveAttribute("download");
    expect(downloadLink).toHaveAttribute("href");
  });

  // ── Selection mode tests ─────────────────────

  it("shows checkbox when selectionMode is true", () => {
    const item = createMockItem();
    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        selectionMode={true}
        isChecked={false}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByTestId("selection-checkbox")).toBeInTheDocument();
  });

  it("checkbox shows checked state when isChecked is true", () => {
    const item = createMockItem();
    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        selectionMode={true}
        isChecked={true}
        onToggle={vi.fn()}
      />,
    );

    const checkbox = screen.getByTestId("selection-checkbox");
    expect(checkbox.className).toContain("bg-primary");
  });

  it("click calls onToggle instead of onClick in selection mode", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onToggle = vi.fn();
    const item = createMockItem();

    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={onClick}
        selectionMode={true}
        isChecked={false}
        onToggle={onToggle}
      />,
    );

    // Click anywhere on the card
    await user.click(screen.getByText("Favicon"));
    expect(onToggle).toHaveBeenCalledWith(item.id);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("hides three-dot menu in selection mode", () => {
    const item = createMockItem();
    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        selectionMode={true}
        isChecked={false}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Ações")).not.toBeInTheDocument();
  });

  it("does not show checkbox when selectionMode is false", () => {
    const item = createMockItem();
    render(
      <HistoryCard item={item} isSelected={false} onClick={vi.fn()} />,
    );

    expect(screen.queryByTestId("selection-checkbox")).not.toBeInTheDocument();
  });

  // ── Rename tests ─────────────────────────────

  it("shows Renomear in menu when onRename is provided", async () => {
    const user = userEvent.setup();
    const item = createMockItem();
    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Ações"));
    expect(
      screen.getByRole("menuitem", { name: /renomear/i }),
    ).toBeInTheDocument();
  });

  it("calls onRename with item when Renomear is clicked", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const item = createMockItem();

    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onRename={onRename}
      />,
    );

    await user.click(screen.getByLabelText("Ações"));
    await user.click(screen.getByRole("menuitem", { name: /renomear/i }));
    expect(onRename).toHaveBeenCalledWith(item);
  });

  it("prefers displayName for card title", () => {
    const item = createMockItem({
      displayName: "Meu Banner Custom",
      imageTypeName: "Favicon",
    });
    render(<HistoryCard item={item} isSelected={false} onClick={vi.fn()} />);

    expect(screen.getByText("Meu Banner Custom")).toBeInTheDocument();
  });

  it("shows kebab menu when only onRename is provided (no onDelete)", async () => {
    const user = userEvent.setup();
    const item = createMockItem();
    render(
      <HistoryCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Ações")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Ações"));
    expect(
      screen.getByRole("menuitem", { name: /renomear/i }),
    ).toBeInTheDocument();
    // Excluir should NOT be in menu
    expect(
      screen.queryByRole("menuitem", { name: /excluir/i }),
    ).not.toBeInTheDocument();
  });
});
