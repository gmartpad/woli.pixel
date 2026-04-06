import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryGrid } from "./HistoryGrid";
import type { HistoryItem } from "@/lib/api";

vi.mock("./HistoryCard", () => ({
  HistoryCard: (props: any) => (
    <div data-testid="history-card">{props.item.id}</div>
  ),
}));

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

function todayISO(): string {
  const now = new Date();
  now.setHours(10, 0, 0, 0);
  return now.toISOString();
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

describe("HistoryGrid", () => {
  it("renders items grouped by date with headers containing 'Hoje' and 'Ontem'", () => {
    const items: HistoryItem[] = [
      createMockItem({ id: "today-1", createdAt: todayISO() }),
      createMockItem({ id: "yesterday-1", createdAt: yesterdayISO() }),
    ];

    render(
      <HistoryGrid
        items={items}
        total={2}
        hasMore={false}
        selectedItemId={null}
        onSelectItem={vi.fn()}
        onLoadMore={vi.fn()}
        isLoadingMore={false}
      />,
    );

    expect(screen.getByText(/Hoje/)).toBeInTheDocument();
    expect(screen.getByText(/Ontem/)).toBeInTheDocument();
    expect(screen.getAllByTestId("history-card")).toHaveLength(2);
  });

  it('shows "Carregar Mais" button when hasMore=true with count text', () => {
    const items: HistoryItem[] = [
      createMockItem({ id: "item-1", createdAt: todayISO() }),
      createMockItem({ id: "item-2", createdAt: todayISO() }),
    ];

    render(
      <HistoryGrid
        items={items}
        total={10}
        hasMore={true}
        selectedItemId={null}
        onSelectItem={vi.fn()}
        onLoadMore={vi.fn()}
        isLoadingMore={false}
      />,
    );

    expect(screen.getByText(/Mostrando 2 de 10/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Carregar Mais/ }),
    ).toBeInTheDocument();
  });

  it("calls onLoadMore when 'Carregar Mais' button is clicked", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    const items: HistoryItem[] = [
      createMockItem({ id: "item-1", createdAt: todayISO() }),
    ];

    render(
      <HistoryGrid
        items={items}
        total={5}
        hasMore={true}
        selectedItemId={null}
        onSelectItem={vi.fn()}
        onLoadMore={onLoadMore}
        isLoadingMore={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Carregar Mais/ }));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("hides 'Carregar Mais' button when hasMore=false", () => {
    const items: HistoryItem[] = [
      createMockItem({ id: "item-1", createdAt: todayISO() }),
    ];

    render(
      <HistoryGrid
        items={items}
        total={1}
        hasMore={false}
        selectedItemId={null}
        onSelectItem={vi.fn()}
        onLoadMore={vi.fn()}
        isLoadingMore={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Carregar Mais/ }),
    ).not.toBeInTheDocument();
  });

  it('shows "Carregando..." when isLoadingMore=true', () => {
    const items: HistoryItem[] = [
      createMockItem({ id: "item-1", createdAt: todayISO() }),
    ];

    render(
      <HistoryGrid
        items={items}
        total={5}
        hasMore={true}
        selectedItemId={null}
        onSelectItem={vi.fn()}
        onLoadMore={vi.fn()}
        isLoadingMore={true}
      />,
    );

    const button = screen.getByRole("button", { name: /Carregando\.\.\./ });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  describe("accordion behavior", () => {
    it("renders date headers as buttons with aria-expanded=true by default", () => {
      const items: HistoryItem[] = [
        createMockItem({ id: "today-1", createdAt: todayISO() }),
        createMockItem({ id: "yesterday-1", createdAt: yesterdayISO() }),
      ];

      render(
        <HistoryGrid
          items={items}
          total={2}
          hasMore={false}
          selectedItemId={null}
          onSelectItem={vi.fn()}
          onLoadMore={vi.fn()}
          isLoadingMore={false}
        />,
      );

      const hojeButton = screen.getByRole("button", { name: /Hoje/ });
      const ontemButton = screen.getByRole("button", { name: /Ontem/ });

      expect(hojeButton).toHaveAttribute("aria-expanded", "true");
      expect(ontemButton).toHaveAttribute("aria-expanded", "true");
    });

    it("displays item count in each date header", () => {
      const items: HistoryItem[] = [
        createMockItem({ id: "today-1", createdAt: todayISO() }),
        createMockItem({ id: "today-2", createdAt: todayISO() }),
        createMockItem({ id: "yesterday-1", createdAt: yesterdayISO() }),
      ];

      render(
        <HistoryGrid
          items={items}
          total={3}
          hasMore={false}
          selectedItemId={null}
          onSelectItem={vi.fn()}
          onLoadMore={vi.fn()}
          isLoadingMore={false}
        />,
      );

      expect(screen.getByText("(2)")).toBeInTheDocument();
      expect(screen.getByText("(1)")).toBeInTheDocument();
    });

    it("collapses a group when its header button is clicked", async () => {
      const user = userEvent.setup();
      const items: HistoryItem[] = [
        createMockItem({ id: "today-1", createdAt: todayISO() }),
        createMockItem({ id: "yesterday-1", createdAt: yesterdayISO() }),
      ];

      render(
        <HistoryGrid
          items={items}
          total={2}
          hasMore={false}
          selectedItemId={null}
          onSelectItem={vi.fn()}
          onLoadMore={vi.fn()}
          isLoadingMore={false}
        />,
      );

      const hojeButton = screen.getByRole("button", { name: /Hoje/ });
      await user.click(hojeButton);

      expect(hojeButton).toHaveAttribute("aria-expanded", "false");
      // Ontem should remain expanded
      expect(screen.getByRole("button", { name: /Ontem/ })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    it("expands a collapsed group when its header is clicked again", async () => {
      const user = userEvent.setup();
      const items: HistoryItem[] = [
        createMockItem({ id: "today-1", createdAt: todayISO() }),
      ];

      render(
        <HistoryGrid
          items={items}
          total={1}
          hasMore={false}
          selectedItemId={null}
          onSelectItem={vi.fn()}
          onLoadMore={vi.fn()}
          isLoadingMore={false}
        />,
      );

      const hojeButton = screen.getByRole("button", { name: /Hoje/ });
      await user.click(hojeButton);
      expect(hojeButton).toHaveAttribute("aria-expanded", "false");

      await user.click(hojeButton);
      expect(hojeButton).toHaveAttribute("aria-expanded", "true");
    });

    it("allows multiple groups to be independently collapsed", async () => {
      const user = userEvent.setup();
      const items: HistoryItem[] = [
        createMockItem({ id: "today-1", createdAt: todayISO() }),
        createMockItem({ id: "yesterday-1", createdAt: yesterdayISO() }),
      ];

      render(
        <HistoryGrid
          items={items}
          total={2}
          hasMore={false}
          selectedItemId={null}
          onSelectItem={vi.fn()}
          onLoadMore={vi.fn()}
          isLoadingMore={false}
        />,
      );

      const hojeButton = screen.getByRole("button", { name: /Hoje/ });
      const ontemButton = screen.getByRole("button", { name: /Ontem/ });

      // Collapse both
      await user.click(hojeButton);
      await user.click(ontemButton);

      expect(hojeButton).toHaveAttribute("aria-expanded", "false");
      expect(ontemButton).toHaveAttribute("aria-expanded", "false");

      // Expand only Ontem
      await user.click(ontemButton);
      expect(hojeButton).toHaveAttribute("aria-expanded", "false");
      expect(ontemButton).toHaveAttribute("aria-expanded", "true");
    });

    it("sets grid-template-rows to 0fr when collapsed", async () => {
      const user = userEvent.setup();
      const items: HistoryItem[] = [
        createMockItem({ id: "today-1", createdAt: todayISO() }),
      ];

      const { container } = render(
        <HistoryGrid
          items={items}
          total={1}
          hasMore={false}
          selectedItemId={null}
          onSelectItem={vi.fn()}
          onLoadMore={vi.fn()}
          isLoadingMore={false}
        />,
      );

      const hojeButton = screen.getByRole("button", { name: /Hoje/ });
      const sectionId = hojeButton.getAttribute("aria-controls")!;
      const section = container.querySelector(`#${sectionId}`)!;

      expect(section).toHaveStyle({ gridTemplateRows: "1fr" });

      await user.click(hojeButton);
      expect(section).toHaveStyle({ gridTemplateRows: "0fr" });
    });
  });
});
