import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeneratePanel } from "./GeneratePanel";
import { useGenerationStore } from "@/stores/generation-store";
import { createQueryWrapper } from "@/test/query-wrapper";

describe("GeneratePanel custom resolution integration", () => {
  beforeEach(() => {
    useGenerationStore.getState().reset();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ grouped: { admin: [] } })),
    );
  });

  it("renders 'Personalizado' tab", async () => {
    render(<GeneratePanel />, { wrapper: createQueryWrapper() });
    expect(await screen.findByText("Personalizado")).toBeInTheDocument();
  });

  it("shows custom resolution inputs when Personalizado tab is clicked", async () => {
    const user = userEvent.setup();
    render(<GeneratePanel />, { wrapper: createQueryWrapper() });

    await user.click(await screen.findByText("Personalizado"));

    expect(screen.getByLabelText("Largura (px)")).toBeInTheDocument();
    expect(screen.getByLabelText("Altura (px)")).toBeInTheDocument();
  });

  it("shows StyleSelector when Personalizado tab is active", async () => {
    const user = userEvent.setup();
    render(<GeneratePanel />, { wrapper: createQueryWrapper() });

    await user.click(await screen.findByText("Personalizado"));

    expect(screen.getByText("Automático")).toBeInTheDocument();
    expect(screen.getByText("Fotorrealista")).toBeInTheDocument();
  });

  it("shows CustomPresetManager when Personalizado tab is active", async () => {
    const user = userEvent.setup();
    render(<GeneratePanel />, { wrapper: createQueryWrapper() });

    await user.click(await screen.findByText("Personalizado"));

    expect(screen.getByText("Presets Salvos")).toBeInTheDocument();
  });

  it("does NOT show system preset cards when Personalizado tab is active", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          grouped: {
            admin: [
              { id: "t1", category: "admin", typeKey: "favicon", displayName: "Favicon", width: 128, height: 128, maxFileSizeKb: 500, allowedFormats: ["png"], services: null },
            ],
          },
        }),
      ),
    );

    const user = userEvent.setup();
    render(<GeneratePanel />, { wrapper: createQueryWrapper() });

    // Wait for system tabs and type cards to load
    expect(await screen.findByText("Favicon")).toBeInTheDocument();

    // Switch to custom tab
    await user.click(screen.getByText("Personalizado"));

    // Favicon card should no longer be visible
    expect(screen.queryByText("Favicon")).not.toBeInTheDocument();
  });

  it("enables generate button when custom dimensions and valid prompt are set", async () => {
    const user = userEvent.setup();
    render(<GeneratePanel />, { wrapper: createQueryWrapper() });

    // Switch to custom tab
    await user.click(await screen.findByText("Personalizado"));

    // Set dimensions
    const widthInput = screen.getByLabelText("Largura (px)");
    const heightInput = screen.getByLabelText("Altura (px)");
    await user.type(widthInput, "1024");
    await user.type(heightInput, "1024");

    // Set prompt (10+ chars)
    const promptInput = screen.getByPlaceholderText(/Descreva a imagem/);
    await user.type(promptInput, "Uma paisagem bonita com montanhas ao fundo");

    const generateBtn = screen.getByRole("button", { name: /Gerar Imagem/i });
    expect(generateBtn).not.toBeDisabled();
  });

  it("keeps system preset tabs working after visiting custom tab", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          grouped: {
            admin: [
              { id: "t1", category: "admin", typeKey: "favicon", displayName: "Favicon", width: 128, height: 128, maxFileSizeKb: 500, allowedFormats: ["png"], services: null },
            ],
          },
        }),
      ),
    );

    const user = userEvent.setup();
    render(<GeneratePanel />, { wrapper: createQueryWrapper() });

    // Wait for first tab to render with type cards
    expect(await screen.findByText("Favicon")).toBeInTheDocument();

    // Go to custom
    await user.click(screen.getByText("Personalizado"));
    expect(screen.queryByText("Favicon")).not.toBeInTheDocument();

    // Return to admin tab
    const adminTab = screen.getByRole("tab", { name: /Admin/i });
    await user.click(adminTab);
    expect(screen.getByText("Favicon")).toBeInTheDocument();
  });
});
