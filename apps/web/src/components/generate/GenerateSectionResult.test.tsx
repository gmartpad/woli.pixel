import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGenerationStore } from "@/stores/generation-store";
import { GenerateSectionResult } from "./GenerateSectionResult";

// Mock useAuthImage to return blob URL synchronously in tests
vi.mock("@/hooks/useAuthImage", () => ({
  useAuthImage: (url: string | null) => ({
    src: url ? `blob:test/${url}` : null,
    loading: false,
  }),
}));

// Mock auth-download to avoid real fetch
vi.mock("@/lib/auth-download", () => ({
  downloadAuthFile: vi.fn(),
  downloadBlobUrl: vi.fn(),
}));

const MOCK_RESULT = {
  id: "gen-1",
  model: "recraft_v3",
  prompt: "A colorful favicon",
  enhanced_prompt: "A colorful favicon enhanced",
  quality_tier: "medium" as const,
  cost_usd: 0.011,
  image: {
    width: 128,
    height: 128,
    format: "png",
    size_kb: 50,
    download_url: "/api/v1/download/gen-1",
  },
};

describe("GenerateSectionResult", () => {
  beforeEach(() => {
    useGenerationStore.setState({
      step: "completed",
      result: MOCK_RESULT,
      prompt: "A colorful favicon",
    });
  });

  it("renders the generated image preview", () => {
    render(<GenerateSectionResult />);
    expect(screen.getByAltText("Generated")).toBeInTheDocument();
  });

  it("displays image dimension metadata", () => {
    render(<GenerateSectionResult />);
    expect(screen.getByText("128x128px")).toBeInTheDocument();
  });

  it("displays image size metadata", () => {
    render(<GenerateSectionResult />);
    expect(screen.getByText("50 KB")).toBeInTheDocument();
  });

  // PRICING_HIDDEN: commented out for demo
  // it("displays cost information", () => {
  //   render(<GenerateSectionResult />);
  //   expect(screen.getByText("$0.011")).toBeInTheDocument();
  // });

  it("displays model badge", () => {
    render(<GenerateSectionResult />);
    expect(screen.getByText("Recraft V3")).toBeInTheDocument();
  });

  it("renders download link", () => {
    render(<GenerateSectionResult />);
    expect(screen.getByText("Download")).toBeInTheDocument();
  });

  it("renders nova geracao button that resets the store", async () => {
    const user = userEvent.setup();
    render(<GenerateSectionResult />);
    const resetBtn = screen.getByText("Nova Geração");
    expect(resetBtn).toBeInTheDocument();
    await user.click(resetBtn);
    expect(useGenerationStore.getState().step).toBe("idle");
    expect(useGenerationStore.getState().result).toBeNull();
    expect(useGenerationStore.getState().prompt).toBe("");
  });

  it("shows empty state when no result", () => {
    useGenerationStore.setState({ step: "idle", result: null });
    render(<GenerateSectionResult />);
    expect(screen.getByText(/nenhuma imagem gerada/i)).toBeInTheDocument();
  });

  it("renders format selector with all format options", () => {
    render(<GenerateSectionResult />);
    const formatGroup = screen.getByRole("group", { name: /formato de download/i });
    expect(within(formatGroup).getByText("JPEG")).toBeInTheDocument();
    expect(within(formatGroup).getByText("PNG")).toBeInTheDocument();
    expect(within(formatGroup).getByText("WebP")).toBeInTheDocument();
  });

  it("reuses preview blob for same-format download instead of fetching again", async () => {
    const { downloadBlobUrl } = await import("@/lib/auth-download");
    const { downloadAuthFile } = await import("@/lib/auth-download");
    const user = userEvent.setup();

    // Mock result is PNG, default downloadFormat syncs to png via useEffect
    useGenerationStore.setState({
      step: "completed",
      result: { ...MOCK_RESULT, image: { ...MOCK_RESULT.image, format: "jpeg" } },
      prompt: "test",
    });
    render(<GenerateSectionResult />);

    await user.click(screen.getByText("Download"));

    expect(downloadBlobUrl).toHaveBeenCalledWith(
      expect.stringContaining("blob:test/"),
      expect.stringContaining("generated-"),
    );
    expect(downloadAuthFile).not.toHaveBeenCalled();
  });

  it("fetches from API when download format differs from native format", async () => {
    const { downloadBlobUrl } = await import("@/lib/auth-download");
    const { downloadAuthFile } = await import("@/lib/auth-download");
    vi.mocked(downloadBlobUrl).mockClear();
    vi.mocked(downloadAuthFile).mockClear();

    const user = userEvent.setup();
    render(<GenerateSectionResult />);

    // Default format is PNG (from MOCK_RESULT). Switch to WebP.
    const formatGroup = screen.getByRole("group", { name: /formato de download/i });
    await user.click(within(formatGroup).getByText("WebP"));
    await user.click(screen.getByText("Download"));

    expect(downloadAuthFile).toHaveBeenCalledWith(
      expect.stringContaining("format=webp"),
      expect.stringContaining(".webp"),
    );
    expect(downloadBlobUrl).not.toHaveBeenCalled();
  });
});
