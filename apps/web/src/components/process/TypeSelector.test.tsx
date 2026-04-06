import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TypeSelector } from "./TypeSelector";

const mockFetchImageTypes = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchImageTypes: (...args: unknown[]) => mockFetchImageTypes(...args),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderWithQuery(
  selectedTypeId: string | null,
  onSelectType: ReturnType<typeof vi.fn>,
  suggestedTypeId?: string | null,
) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <TypeSelector
        selectedTypeId={selectedTypeId}
        onSelectType={onSelectType}
        suggestedTypeId={suggestedTypeId}
      />
    </QueryClientProvider>,
  );
}

describe("TypeSelector", () => {
  let onSelectType: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSelectType = vi.fn();
    mockFetchImageTypes.mockResolvedValue({
      grouped: {
        admin: [
          {
            id: "type-1",
            category: "admin",
            typeKey: "fundo_login",
            displayName: "Fundo Login",
            width: 1920,
            height: 1080,
            aspectRatio: "16:9",
            maxFileSizeKb: 500,
            allowedFormats: ["jpeg", "png"],
            services: null,
          },
        ],
        content: [
          {
            id: "type-2",
            category: "content",
            typeKey: "conteudo_imagem",
            displayName: "Conteúdo Imagem",
            width: 800,
            height: 600,
            aspectRatio: "4:3",
            maxFileSizeKb: 10240,
            allowedFormats: ["jpeg", "png", "webp"],
            services: ["resize"],
          },
        ],
      },
    });
  });

  it("renders category tabs", async () => {
    renderWithQuery(null, onSelectType);
    expect(await screen.findByRole("tab", { name: /admin/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /conteúdo/i })).toBeInTheDocument();
  });

  it("renders type cards for the active tab", async () => {
    renderWithQuery(null, onSelectType);
    // First tab (admin) is active by default
    expect(await screen.findByRole("button", { name: /fundo login/i })).toBeInTheDocument();
  });

  it("switches tabs on click", async () => {
    const user = userEvent.setup();
    renderWithQuery(null, onSelectType);

    const contentTab = await screen.findByRole("tab", { name: /conteúdo/i });
    await user.click(contentTab);

    expect(await screen.findByRole("button", { name: /conteúdo imagem/i })).toBeInTheDocument();
  });

  it("calls onSelectType when a type card is clicked", async () => {
    const user = userEvent.setup();
    renderWithQuery(null, onSelectType);

    const card = await screen.findByRole("button", { name: /fundo login/i });
    await user.click(card);

    expect(onSelectType).toHaveBeenCalledWith("type-1");
  });

  it("highlights the selected type card", async () => {
    renderWithQuery("type-1", onSelectType);
    const card = await screen.findByRole("button", { name: /fundo login/i });
    // Selected card has border-primary class (via border-2)
    expect(card.className).toContain("border-primary");
  });

  it("shows type dimensions and max file size", async () => {
    renderWithQuery(null, onSelectType);
    await screen.findByRole("button", { name: /fundo login/i });
    expect(screen.getByText(/1920 x 1080 px/)).toBeInTheDocument();
    expect(screen.getByText(/500 KB/)).toBeInTheDocument();
  });

  it("shows services badges when present", async () => {
    const user = userEvent.setup();
    renderWithQuery(null, onSelectType);

    // Switch to content tab to see type with services
    const contentTab = await screen.findByRole("tab", { name: /conteúdo/i });
    await user.click(contentTab);

    await screen.findByRole("button", { name: /conteúdo imagem/i });
    expect(screen.getByText("resize")).toBeInTheDocument();
  });

  // ── Issue 4: AI-suggested type ──────────────

  it("shows 'Sugerido pela IA' badge on suggested type card", async () => {
    renderWithQuery(null, onSelectType, "type-1");
    await screen.findByRole("button", { name: /fundo login/i });
    expect(screen.getByText("Sugerido pela IA")).toBeInTheDocument();
  });

  it("auto-activates tab containing the suggested type", async () => {
    // type-2 is in the "content" category
    renderWithQuery(null, onSelectType, "type-2");
    const contentTab = await screen.findByRole("tab", { name: /conteúdo/i });
    expect(contentTab).toHaveAttribute("aria-selected", "true");
  });

  it("does not show AI badge when suggestedTypeId is null", async () => {
    renderWithQuery(null, onSelectType, null);
    await screen.findByRole("button", { name: /fundo login/i });
    expect(screen.queryByText("Sugerido pela IA")).not.toBeInTheDocument();
  });

  it("works without suggestedTypeId prop (backward compat)", async () => {
    renderWithQuery(null, onSelectType);
    await screen.findByRole("button", { name: /fundo login/i });
    expect(screen.queryByText("Sugerido pela IA")).not.toBeInTheDocument();
  });

  it("shows 'Variável' for types without fixed dimensions", async () => {
    mockFetchImageTypes.mockResolvedValue({
      grouped: {
        admin: [
          {
            id: "type-v",
            category: "admin",
            typeKey: "variable",
            displayName: "Variable Type",
            width: null,
            height: null,
            aspectRatio: null,
            maxFileSizeKb: 256,
            allowedFormats: ["png"],
            services: null,
          },
        ],
      },
    });

    renderWithQuery(null, onSelectType);
    await screen.findByRole("button", { name: /variable type/i });
    expect(screen.getByText("Variável")).toBeInTheDocument();
  });
});
