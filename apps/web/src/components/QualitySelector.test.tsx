import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { QualitySelector } from "./QualitySelector";
import { createQueryWrapper } from "@/test/query-wrapper";

vi.mock("@/lib/api", () => ({
  fetchPresetCost: vi.fn().mockResolvedValue({
    typeKey: "favicon",
    displayName: "Favicon",
    targetWidth: 128,
    targetHeight: 128,
    openaiSize: "1024x1024",
    costs: { low: 0.005, medium: 0.011, high: 0.036 },
    notes: null,
  }),
}));

function renderWithQuery(ui: React.ReactElement) {
  return render(ui, { wrapper: createQueryWrapper() });
}

describe("QualitySelector", () => {
  it("renders 3 quality tier buttons", () => {
    const onSelect = vi.fn();
    renderWithQuery(
      <QualitySelector selectedTier="medium" onSelect={onSelect} typeKey="favicon" />,
    );

    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("Alta Qualidade")).toBeInTheDocument();
  });

  it("renders descriptions for each tier", () => {
    const onSelect = vi.fn();
    renderWithQuery(
      <QualitySelector selectedTier="medium" onSelect={onSelect} typeKey="favicon" />,
    );

    expect(screen.getByText("Preview rápido")).toBeInTheDocument();
    expect(screen.getByText("Uso geral")).toBeInTheDocument();
    expect(screen.getByText("Produção")).toBeInTheDocument();
  });

  it("selected tier has primary styling (text-primary class)", () => {
    const onSelect = vi.fn();
    renderWithQuery(
      <QualitySelector selectedTier="medium" onSelect={onSelect} typeKey="favicon" />,
    );

    // The selected button (Padrao) should have the primary styling class
    const selectedButton = screen.getByText("Padrão").closest("button");
    expect(selectedButton).not.toBeNull();
    expect(selectedButton!.className).toContain("text-primary");

    // Non-selected buttons should not have primary styling
    const lowButton = screen.getByText("Rascunho").closest("button");
    expect(lowButton!.className).not.toContain("text-primary");

    const highButton = screen.getByText("Alta Qualidade").closest("button");
    expect(highButton!.className).not.toContain("text-primary");
  });

  it('clicking "Rascunho" calls onSelect with "low"', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithQuery(
      <QualitySelector selectedTier="medium" onSelect={onSelect} typeKey="favicon" />,
    );

    await user.click(screen.getByText("Rascunho"));
    expect(onSelect).toHaveBeenCalledWith("low");
  });

  it('clicking "Padrão" calls onSelect with "medium"', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithQuery(
      <QualitySelector selectedTier="low" onSelect={onSelect} typeKey="favicon" />,
    );

    await user.click(screen.getByText("Padrão"));
    expect(onSelect).toHaveBeenCalledWith("medium");
  });

  it('clicking "Alta Qualidade" calls onSelect with "high"', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithQuery(
      <QualitySelector selectedTier="medium" onSelect={onSelect} typeKey="favicon" />,
    );

    await user.click(screen.getByText("Alta Qualidade"));
    expect(onSelect).toHaveBeenCalledWith("high");
  });

  it("medium is default when passed as selectedTier", () => {
    const onSelect = vi.fn();
    renderWithQuery(
      <QualitySelector selectedTier="medium" onSelect={onSelect} typeKey="favicon" />,
    );

    const mediumButton = screen.getByText("Padrão").closest("button");
    expect(mediumButton!.className).toContain("text-primary");
    expect(mediumButton!.className).toContain("shadow-lg");
  });

  it("renders without crashing when typeKey is null", () => {
    const onSelect = vi.fn();
    renderWithQuery(
      <QualitySelector selectedTier="medium" onSelect={onSelect} typeKey={null} />,
    );

    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("Alta Qualidade")).toBeInTheDocument();
  });
});
