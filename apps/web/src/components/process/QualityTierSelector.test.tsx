import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QualityTierSelector } from "./QualityTierSelector";

describe("QualityTierSelector", () => {
  let onSelectTier: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSelectTier = vi.fn();
  });

  it("renders all three quality tier buttons", () => {
    render(<QualityTierSelector selectedTier="medium" onSelectTier={onSelectTier} />);
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("Alta Qualidade")).toBeInTheDocument();
  });

  it("renders tier descriptions", () => {
    render(<QualityTierSelector selectedTier="medium" onSelectTier={onSelectTier} />);
    expect(screen.getByText("Preview rápido")).toBeInTheDocument();
    expect(screen.getByText("Uso geral")).toBeInTheDocument();
    expect(screen.getByText("Produção")).toBeInTheDocument();
  });

  it("highlights the selected tier", () => {
    render(<QualityTierSelector selectedTier="high" onSelectTier={onSelectTier} />);
    const highBtn = screen.getByText("Alta Qualidade").closest("button")!;
    expect(highBtn.className).toContain("text-primary");
    expect(highBtn.className).toContain("shadow-lg");
  });

  it("calls onSelectTier when a tier is clicked", async () => {
    const user = userEvent.setup();
    render(<QualityTierSelector selectedTier="medium" onSelectTier={onSelectTier} />);
    await user.click(screen.getByText("Alta Qualidade"));
    expect(onSelectTier).toHaveBeenCalledWith("high");
  });

  it("calls onSelectTier with 'low' for Rascunho", async () => {
    const user = userEvent.setup();
    render(<QualityTierSelector selectedTier="medium" onSelectTier={onSelectTier} />);
    await user.click(screen.getByText("Rascunho"));
    expect(onSelectTier).toHaveBeenCalledWith("low");
  });
});
