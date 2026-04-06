import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGenerationStore } from "@/stores/generation-store";
import { GenerateSectionQuality } from "./GenerateSectionQuality";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  fetchImageTypes: vi.fn(() =>
    Promise.resolve({
      grouped: {
        admin: [
          { id: "t2", category: "admin", typeKey: "favicon", displayName: "Favicon", width: 128, height: 128, maxFileSizeKb: 500, allowedFormats: ["png"], services: null },
        ],
      },
    }),
  ),
  getGenerationCostEstimate: vi.fn(() =>
    Promise.resolve({
      estimatedCostUsd: 0.011,
      needsTransparency: false,
    }),
  ),
  getCustomResolutionCostEstimate: vi.fn(() =>
    Promise.resolve({
      estimatedCostUsd: 0.015,
      model: "flux2_pro",
    }),
  ),
  generateImage: vi.fn(() =>
    Promise.resolve({
      id: "gen-1",
      model: "recraft_v3",
      prompt: "test",
      enhanced_prompt: "test enhanced",
      quality_tier: "medium",
      cost_usd: 0.011,
      image: { width: 128, height: 128, format: "png", size_kb: 50, download_url: "/api/v1/download/gen-1" },
    }),
  ),
  generateImageCustom: vi.fn(),
  generateImageFromPreset: vi.fn(),
  ModerationRejectedError: class extends Error {
    moderation: { analysis: string; suggested_prompt: string; flagged_reasons: string[] };
    constructor(data: { error: string; moderation: { analysis: string; suggested_prompt: string; flagged_reasons: string[] } }) {
      super(data.error);
      this.moderation = data.moderation;
    }
  },
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("GenerateSectionQuality", () => {
  beforeEach(() => {
    useGenerationStore.setState({
      step: "idle",
      selectedTypeId: "t2",
      prompt: "A colorful favicon for the app",
      qualityTier: "medium",
      generationMode: "preset",
      customWidth: null,
      customHeight: null,
      customStyle: "auto",
      customPresetId: null,
      result: null,
      error: null,
      moderation: null,
    });
  });

  it("renders the quality selector", () => {
    render(<GenerateSectionQuality />, { wrapper: createWrapper() });
    expect(screen.getByText("Qualidade da Geração")).toBeInTheDocument();
  });

  it("renders the generate button", () => {
    render(<GenerateSectionQuality />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: /gerar imagem/i })).toBeInTheDocument();
  });

  it("disables generate button when prompt is too short", () => {
    useGenerationStore.setState({ prompt: "short" });
    render(<GenerateSectionQuality />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: /gerar imagem/i })).toBeDisabled();
  });

  it("disables generate button when no type is selected and no custom dimensions", () => {
    useGenerationStore.setState({
      selectedTypeId: null,
      customWidth: null,
      customHeight: null,
      customPresetId: null,
    });
    render(<GenerateSectionQuality />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: /gerar imagem/i })).toBeDisabled();
  });

  it("enables generate button when conditions are met", () => {
    render(<GenerateSectionQuality />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: /gerar imagem/i })).not.toBeDisabled();
  });

  it("shows loading state when generating", () => {
    useGenerationStore.setState({ step: "generating" });
    render(<GenerateSectionQuality />, { wrapper: createWrapper() });
    expect(screen.getByText(/gerando imagem/i)).toBeInTheDocument();
  });

  it("displays error when present", () => {
    useGenerationStore.setState({ step: "error", error: "Something went wrong" });
    render(<GenerateSectionQuality />, { wrapper: createWrapper() });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("displays moderation alert when moderated", () => {
    useGenerationStore.setState({
      step: "moderated",
      moderation: {
        analysis: "Content policy violation",
        suggestedPrompt: "A friendly illustration",
        flaggedReasons: ["violence"],
      },
    });
    render(<GenerateSectionQuality />, { wrapper: createWrapper() });
    expect(screen.getByText("Prompt rejeitado pela política de conteúdo")).toBeInTheDocument();
    expect(screen.getByText("violence")).toBeInTheDocument();
  });

  it("applies suggested prompt when button is clicked", async () => {
    const user = userEvent.setup();
    useGenerationStore.setState({
      step: "moderated",
      moderation: {
        analysis: "Content policy violation",
        suggestedPrompt: "A friendly illustration",
        flaggedReasons: ["violence"],
      },
    });
    render(<GenerateSectionQuality />, { wrapper: createWrapper() });
    await user.click(screen.getByText("Usar prompt sugerido"));
    expect(useGenerationStore.getState().prompt).toBe("A friendly illustration");
    expect(useGenerationStore.getState().step).toBe("idle");
  });
});
