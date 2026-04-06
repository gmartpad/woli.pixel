import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CustomPresetManager } from "./CustomPresetManager";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockPresets = [
  { id: "1", name: "Banner HD", width: 1920, height: 1080, style: "photorealistic", outputFormat: "jpeg", maxFileSizeKb: 500, requiresTransparency: false, promptContext: null, createdAt: "2026-04-01" },
  { id: "2", name: "Icone App", width: 256, height: 256, style: "illustration", outputFormat: "png", maxFileSizeKb: 500, requiresTransparency: true, promptContext: null, createdAt: "2026-04-02" },
];

describe("CustomPresetManager", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: mockPresets })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows preset names after loading", async () => {
    render(
      <CustomPresetManager width={null} height={null} onSelectPreset={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(await screen.findByText("Banner HD")).toBeInTheDocument();
    expect(screen.getByText("Icone App")).toBeInTheDocument();
  });

  it("shows dimensions on preset cards", async () => {
    render(
      <CustomPresetManager width={null} height={null} onSelectPreset={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(await screen.findByText(/1920.*1080/)).toBeInTheDocument();
  });

  it("calls onSelectPreset when a preset card is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CustomPresetManager width={null} height={null} onSelectPreset={onSelect} />,
      { wrapper: createWrapper() },
    );

    await screen.findByText("Banner HD");
    await user.click(screen.getByText("Banner HD"));
    expect(onSelect).toHaveBeenCalledWith(mockPresets[0]);
  });

  it("shows 'Salvar como Preset' button when width and height are set", () => {
    render(
      <CustomPresetManager width={1920} height={1080} onSelectPreset={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
  });

  it("does not show save button when dimensions are null", () => {
    render(
      <CustomPresetManager width={null} height={null} onSelectPreset={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
  });

  it("shows empty state when no presets exist", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] })),
    );
    render(
      <CustomPresetManager width={null} height={null} onSelectPreset={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(await screen.findByText(/nenhum preset/i)).toBeInTheDocument();
  });
});
