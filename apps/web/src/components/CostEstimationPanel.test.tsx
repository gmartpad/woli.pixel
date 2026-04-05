import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CostEstimationPanel } from "./CostEstimationPanel";
import { createQueryWrapper } from "@/test/query-wrapper";
import { MOCK_COST_RESPONSE } from "@/test/mocks";

const mockFetchGenerationCosts = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchGenerationCosts: (...args: unknown[]) => mockFetchGenerationCosts(...args),
}));

beforeEach(() => {
  mockFetchGenerationCosts.mockResolvedValue(MOCK_COST_RESPONSE);
});

function renderWithQuery(ui: React.ReactElement) {
  return render(ui, { wrapper: createQueryWrapper() });
}

describe("CostEstimationPanel", () => {
  it("renders the header with title", () => {
    renderWithQuery(<CostEstimationPanel />);

    expect(screen.getByText("Estimativa de Custos")).toBeInTheDocument();
    expect(screen.getByText("gpt-image-1-mini por preset Woli Pixel")).toBeInTheDocument();
  });

  it("is initially collapsed (table not visible)", () => {
    renderWithQuery(<CostEstimationPanel />);

    // Table headers should not be visible when collapsed
    expect(screen.queryByText("Preset")).not.toBeInTheDocument();
    expect(screen.queryByText("OpenAI")).not.toBeInTheDocument();
    expect(screen.queryByText("Carregando custos...")).not.toBeInTheDocument();
  });

  it("clicking header expands the panel", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CostEstimationPanel />);

    await user.click(screen.getByText("Estimativa de Custos"));

    // Panel content area should now be visible (either loading or data)
    await waitFor(() => {
      expect(screen.getByText("Notas")).toBeInTheDocument();
    });
  });

  it("shows cost data after expanding and loading", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CostEstimationPanel />);

    await user.click(screen.getByText("Estimativa de Custos"));

    // Wait for mock data to be loaded
    await waitFor(() => {
      expect(screen.getByText("Favicon")).toBeInTheDocument();
    });

    // Verify preset data from MOCK_COST_RESPONSE is displayed
    expect(screen.getByText("Imagem de Conteúdo")).toBeInTheDocument();
  });

  it("displays quality tier labels from mock data", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CostEstimationPanel />);

    await user.click(screen.getByText("Estimativa de Custos"));

    // Labels appear in both the summary cards and table headers, so use getAllByText
    await waitFor(() => {
      expect(screen.getAllByText("Rascunho").length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText("Padrão").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Alta Qualidade").length).toBeGreaterThanOrEqual(1);
  });

  it("displays totals from mock data", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CostEstimationPanel />);

    await user.click(screen.getByText("Estimativa de Custos"));

    // MOCK_COST_RESPONSE totals: { low: 0.011, medium: 0.026, high: 0.088 }
    // Values appear in summary cards and table footer, so use getAllByText
    await waitFor(() => {
      expect(screen.getAllByText(/0\.011/).length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText(/0\.026/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/0\.088/).length).toBeGreaterThanOrEqual(1);
  });

  it("displays square/non-square breakdown from mock data", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CostEstimationPanel />);

    await user.click(screen.getByText("Estimativa de Custos"));

    // MOCK_COST_RESPONSE: squareCount: 1, nonSquareCount: 1
    await waitFor(() => {
      expect(
        screen.getByText("1 presets quadrados (1024x1024) + 1 landscape/portrait (1536x1024)"),
      ).toBeInTheDocument();
    });
  });

  it("displays notes section from mock data", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CostEstimationPanel />);

    await user.click(screen.getByText("Estimativa de Custos"));

    await waitFor(() => {
      expect(screen.getByText("Notas")).toBeInTheDocument();
    });

    // Verify notes from MOCK_COST_RESPONSE
    expect(screen.getByText("Custos de saída apenas.")).toBeInTheDocument();
    expect(screen.getByText("Batch API reduz todos os preços pela metade.")).toBeInTheDocument();
  });

  it("toggles panel closed on second click", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CostEstimationPanel />);

    // Open
    await user.click(screen.getByText("Estimativa de Custos"));
    await waitFor(() => {
      expect(screen.getByText("Favicon")).toBeInTheDocument();
    });

    // Close
    await user.click(screen.getByText("Estimativa de Custos"));
    expect(screen.queryByText("Preset")).not.toBeInTheDocument();
  });

  it("displays preset notes when present", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CostEstimationPanel />);

    await user.click(screen.getByText("Estimativa de Custos"));

    // conteudo_imagem has notes in MOCK_COST_RESPONSE
    await waitFor(() => {
      expect(screen.getByText(/Sharp upscale/)).toBeInTheDocument();
    });
  });
});
