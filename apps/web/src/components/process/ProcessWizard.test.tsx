import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProcessWizard } from "./ProcessWizard";

vi.mock("@/lib/api", () => ({
  uploadImage: vi.fn(),
  fetchImageTypes: vi.fn().mockResolvedValue({ grouped: {} }),
  processImage: vi.fn(),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ProcessWizard />
    </QueryClientProvider>,
  );
}

describe("ProcessWizard", () => {
  it("renders the page title and subtitle", () => {
    renderWithProviders();
    expect(screen.getByText("Curadoria de Imagens por IA")).toBeInTheDocument();
    expect(
      screen.getByText("Valide, redimensione e otimize seus ativos visuais com precisão cirúrgica."),
    ).toBeInTheDocument();
  });

  it("renders the WizardStepper with 3 steps", () => {
    renderWithProviders();
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Análise")).toBeInTheDocument();
    expect(screen.getByText("Resultado")).toBeInTheDocument();
  });

  it("starts on step 0 (Upload)", () => {
    renderWithProviders();
    expect(
      screen.getByText("Arraste imagens aqui ou clique para selecionar"),
    ).toBeInTheDocument();
  });

  it("shows Upload step content on initial render", () => {
    renderWithProviders();
    expect(screen.getByLabelText(/zona de upload de imagens/i)).toBeInTheDocument();
  });
});
