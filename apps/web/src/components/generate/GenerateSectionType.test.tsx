import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGenerationStore } from "@/stores/generation-store";
import { GenerateSectionType } from "./GenerateSectionType";
import { MOCK_IMAGE_TYPES_RESPONSE } from "@/test/mocks";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  fetchImageTypes: vi.fn(() => Promise.resolve(MOCK_IMAGE_TYPES_RESPONSE)),
  fetchCustomPresets: vi.fn(() => Promise.resolve([])),
  createCustomPreset: vi.fn(),
  deleteCustomPreset: vi.fn(),
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

describe("GenerateSectionType", () => {
  beforeEach(() => {
    useGenerationStore.setState({
      selectedTypeId: null,
      generationMode: "preset",
      customWidth: null,
      customHeight: null,
      customStyle: "auto",
      customPresetId: null,
    });
  });

  it("renders category tabs after data loads", async () => {
    render(<GenerateSectionType />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Admin / Branding")).toBeInTheDocument();
    });
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
    expect(screen.getByText("Gamificação")).toBeInTheDocument();
    expect(screen.getByText("Personalizado")).toBeInTheDocument();
  });

  it("displays type cards for the active category tab", async () => {
    render(<GenerateSectionType />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Logo Topo (Header)")).toBeInTheDocument();
    });
    expect(screen.getByText("Favicon")).toBeInTheDocument();
  });

  it("selects a type card and updates the store", async () => {
    const user = userEvent.setup();
    render(<GenerateSectionType />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Favicon")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Favicon"));
    expect(useGenerationStore.getState().selectedTypeId).toBe("t2");
  });

  it("switches category tab to show different types", async () => {
    const user = userEvent.setup();
    render(<GenerateSectionType />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Conteúdo")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Conteúdo"));
    await waitFor(() => {
      expect(screen.getByText("Imagem de Conteúdo")).toBeInTheDocument();
    });
  });

  it("shows custom resolution panel when Personalizado tab is selected", async () => {
    const user = userEvent.setup();
    render(<GenerateSectionType />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Personalizado")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Personalizado"));
    expect(screen.getByLabelText("Largura (px)")).toBeInTheDocument();
    expect(screen.getByLabelText("Altura (px)")).toBeInTheDocument();
  });
});
