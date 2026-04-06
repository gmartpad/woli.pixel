import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGenerationStore } from "@/stores/generation-store";
import { GenerateAccordion } from "./GenerateAccordion";
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
    Promise.resolve({ estimatedCostUsd: 0.011, needsTransparency: false }),
  ),
  getCustomResolutionCostEstimate: vi.fn(() =>
    Promise.resolve({ estimatedCostUsd: 0.015, model: "flux2_pro" }),
  ),
  generateImage: vi.fn(),
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

describe("GenerateAccordion", () => {
  beforeEach(() => {
    useGenerationStore.setState({
      step: "idle",
      selectedTypeId: null,
      prompt: "",
      qualityTier: "medium",
      result: null,
      error: null,
      moderation: null,
      generationMode: "preset",
      customWidth: null,
      customHeight: null,
      customStyle: "auto",
      customPresetId: null,
    });
  });

  it("renders the page title and description", () => {
    render(<GenerateAccordion />, { wrapper: createWrapper() });
    expect(screen.getByText("Geração de Imagens por IA")).toBeInTheDocument();
    expect(
      screen.getByText(/Crie imagens otimizadas para cada preset/i),
    ).toBeInTheDocument();
  });

  it("renders the wizard stepper with 4 step labels", () => {
    render(<GenerateAccordion />, { wrapper: createWrapper() });
    const stepper = screen.getByRole("navigation", { name: "Progresso" });
    expect(within(stepper).getByText("Prompt")).toBeInTheDocument();
    expect(within(stepper).getByText("Tipo")).toBeInTheDocument();
    expect(within(stepper).getByText("Qualidade")).toBeInTheDocument();
    expect(within(stepper).getByText("Resultado")).toBeInTheDocument();
  });

  it("renders all 4 accordion section titles", () => {
    render(<GenerateAccordion />, { wrapper: createWrapper() });
    expect(screen.getByText("Descreva a Imagem")).toBeInTheDocument();
    expect(screen.getByText("Tipo da Imagem")).toBeInTheDocument();
    expect(screen.getByText("Qualidade e Geração")).toBeInTheDocument();
    // "Resultado" appears in both stepper and section -- check both exist
    expect(screen.getAllByText("Resultado").length).toBeGreaterThanOrEqual(2);
  });

  it("section 1 (prompt) is expanded by default", () => {
    render(<GenerateAccordion />, { wrapper: createWrapper() });
    expect(
      screen.getByPlaceholderText(/Descreva a imagem que deseja gerar/i),
    ).toBeInTheDocument();
  });

  it("toggles a section when header is clicked", async () => {
    const user = userEvent.setup();
    render(<GenerateAccordion />, { wrapper: createWrapper() });

    await user.click(screen.getByText("Descreva a Imagem"));

    const headerBtn = screen.getByText("Descreva a Imagem").closest("button");
    expect(headerBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("auto-expands type section when prompt is long enough", async () => {
    render(<GenerateAccordion />, { wrapper: createWrapper() });

    const typeHeader = screen.getByText("Tipo da Imagem").closest("button");
    expect(typeHeader).toHaveAttribute("aria-expanded", "false");

    useGenerationStore.setState({ prompt: "A beautiful landscape painting" });

    await waitFor(() => {
      const updatedTypeHeader = screen.getByText("Tipo da Imagem").closest("button");
      expect(updatedTypeHeader).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("auto-expands quality section when type is selected", async () => {
    render(<GenerateAccordion />, { wrapper: createWrapper() });

    const qualityHeader = screen.getByText("Qualidade e Geração").closest("button");
    expect(qualityHeader).toHaveAttribute("aria-expanded", "false");

    useGenerationStore.setState({ selectedTypeId: "t2" });

    await waitFor(() => {
      const updatedHeader = screen.getByText("Qualidade e Geração").closest("button");
      expect(updatedHeader).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("auto-expands result section when generation completes", async () => {
    render(<GenerateAccordion />, { wrapper: createWrapper() });

    // Find the section header button for "Resultado" (not the stepper label)
    const resultSectionBtns = screen.getAllByText("Resultado");
    const resultHeaderBtn = resultSectionBtns
      .map((el) => el.closest("button"))
      .find((btn) => btn?.hasAttribute("aria-expanded"));
    expect(resultHeaderBtn).toHaveAttribute("aria-expanded", "false");

    useGenerationStore.setState({
      step: "completed",
      result: {
        id: "gen-1",
        model: "recraft_v3",
        prompt: "test",
        enhanced_prompt: "test",
        quality_tier: "medium",
        cost_usd: 0.011,
        image: { width: 128, height: 128, format: "png", size_kb: 50, download_url: "/download/gen-1" },
      },
    });

    await waitFor(() => {
      const updatedResultBtns = screen.getAllByText("Resultado");
      const updatedBtn = updatedResultBtns
        .map((el) => el.closest("button"))
        .find((btn) => btn?.hasAttribute("aria-expanded"));
      expect(updatedBtn).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("shows prompt summary when section is complete and collapsed", async () => {
    const user = userEvent.setup();
    useGenerationStore.setState({ prompt: "A beautiful landscape painting of mountains" });
    render(<GenerateAccordion />, { wrapper: createWrapper() });

    // Collapse prompt section
    await user.click(screen.getByText("Descreva a Imagem"));

    // The summary should appear in the accordion header (truncated), not in the textarea
    await waitFor(() => {
      const summaryEl = screen.getByText(/^— A beautiful landscape painting of mou/);
      expect(summaryEl).toBeInTheDocument();
    });
  });
});
