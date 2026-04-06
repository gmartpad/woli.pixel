import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { useGenerationStore } from "@/stores/generation-store";
import { GenerateSectionResult } from "./GenerateSectionResult";

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

  it("displays cost information", () => {
    render(<GenerateSectionResult />);
    expect(screen.getByText("$0.011")).toBeInTheDocument();
  });

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
});
