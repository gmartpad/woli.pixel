import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createQueryWrapper } from "@/test/query-wrapper";
import { useHistoryStore } from "@/stores/history-store";
import { HistoryPage } from "./HistoryPage";

import type { HistoryResponse } from "@/lib/api";

// ── Mock API module ──────────────────────────
const mockFetchHistory = vi.fn<() => Promise<HistoryResponse>>();

vi.mock("@/lib/api", () => ({
  fetchHistory: (...args: unknown[]) => mockFetchHistory(...(args as [])),
  deleteHistoryItem: vi.fn().mockResolvedValue(undefined),
  bulkDeleteHistory: vi.fn().mockResolvedValue(undefined),
  bulkDownloadHistory: vi.fn().mockResolvedValue(new Blob()),
}));

// ── Mock child components ────────────────────
vi.mock("./HistoryFilterBar", () => ({
  HistoryFilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock("./HistoryGrid", () => ({
  HistoryGrid: (props: { items: unknown[]; selectionMode?: boolean; selectedIds?: unknown; onToggleItem?: unknown }) => (
    <div data-testid="history-grid">{props.items.length} items</div>
  ),
}));

vi.mock("./HistoryEmptyState", () => ({
  HistoryEmptyState: (props: { variant: string }) => (
    <div data-testid="empty-state" data-variant={props.variant} />
  ),
}));

vi.mock("./HistoryDetailPanel", () => ({
  HistoryDetailPanel: () => <div data-testid="detail-panel" />,
}));

vi.mock("./HistoryLightbox", () => ({
  HistoryLightbox: () => <div data-testid="lightbox" />,
}));

vi.mock("./DeleteConfirmDialog", () => ({
  DeleteConfirmDialog: () => <div data-testid="delete-confirm-dialog" />,
}));

vi.mock("./SelectionToolbar", () => ({
  SelectionToolbar: () => <div data-testid="selection-toolbar" />,
}));

// ── Mock useHistoryFilters ───────────────────
vi.mock("@/hooks/useHistoryFilters", () => ({
  useHistoryFilters: () => ({
    filters: {
      mode: "all",
      status: "all",
      categories: [],
      model: "",
      quality: "",
      search: "",
      datePreset: "all",
      dateFrom: "",
      dateTo: "",
    },
    apiParams: {},
    setFilter: vi.fn(),
    toggleCategory: vi.fn(),
    setDateRange: vi.fn(),
    clearAll: vi.fn(),
    activeFilterCount: 0,
  }),
}));

// ── Helpers ──────────────────────────────────
const emptyResponse: HistoryResponse = {
  items: [],
  total: 0,
  page: 1,
  perPage: 24,
  hasMore: false,
};

function makeItem(overrides: Partial<import("@/lib/api").HistoryItem> = {}): import("@/lib/api").HistoryItem {
  return {
    id: "item-1",
    mode: "generation",
    status: "completed",
    createdAt: new Date().toISOString(),
    thumbnailUrl: "/api/v1/thumbnails/item-1",
    downloadUrl: "/api/v1/images/item-1/download",
    category: "branding",
    imageTypeName: "Favicon",
    finalWidth: 256,
    finalHeight: 256,
    finalFormat: "png",
    finalSizeKb: 12,
    prompt: "A test prompt",
    enhancedPrompt: null,
    model: "recraft_v3",
    qualityTier: "medium",
    costUsd: 0.04,
    originalFilename: null,
    originalWidth: null,
    originalHeight: null,
    originalSizeKb: null,
    aiQualityScore: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────
describe("HistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHistoryStore.setState({
      selectedItemId: null,
      panelOpen: false,
      lightboxOpen: false,
      lightboxMode: "single",
    });
  });

  it("renders the filter bar", async () => {
    mockFetchHistory.mockResolvedValue(emptyResponse);

    render(<HistoryPage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId("filter-bar")).toBeInTheDocument();
    });
  });

  it("shows first-use empty state when no items and no filters", async () => {
    mockFetchHistory.mockResolvedValue(emptyResponse);

    render(<HistoryPage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      const emptyState = screen.getByTestId("empty-state");
      expect(emptyState).toBeInTheDocument();
      expect(emptyState).toHaveAttribute("data-variant", "first-use");
    });
  });

  it("shows loading skeleton when data is loading", () => {
    // Never resolve the promise so the query stays in loading state
    mockFetchHistory.mockReturnValue(new Promise(() => {}));

    render(<HistoryPage />, { wrapper: createQueryWrapper() });

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders the grid when items exist", async () => {
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    mockFetchHistory.mockResolvedValue({
      items,
      total: 2,
      page: 1,
      perPage: 24,
      hasMore: false,
    });

    render(<HistoryPage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      const grid = screen.getByTestId("history-grid");
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveTextContent("2 items");
    });
  });
});
