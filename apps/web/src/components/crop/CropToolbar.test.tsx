import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CropToolbar } from "./CropToolbar";
import type { AspectPreset } from "./crop-page-reducer";

const defaultProps = {
  aspectPreset: "free" as AspectPreset,
  zoom: 1,
  croppedWidth: 1920,
  croppedHeight: 1080,
  isSaving: false,
  onAspectChange: vi.fn(),
  onZoomChange: vi.fn(),
  onReset: vi.fn(),
  onSave: vi.fn(),
};

describe("CropToolbar", () => {
  it("renders all aspect preset buttons", () => {
    render(<CropToolbar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /livre/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1:1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4:3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3:4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "16:9" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9:16" })).toBeInTheDocument();
  });

  it("highlights the active aspect preset", () => {
    render(<CropToolbar {...defaultProps} aspectPreset="1:1" />);
    const btn = screen.getByRole("button", { name: "1:1" });
    expect(btn.className).toContain("bg-primary");
  });

  it("calls onAspectChange when a preset is clicked", async () => {
    const onAspectChange = vi.fn();
    render(<CropToolbar {...defaultProps} onAspectChange={onAspectChange} />);
    await userEvent.click(screen.getByRole("button", { name: "4:3" }));
    expect(onAspectChange).toHaveBeenCalledWith("4:3");
  });

  it("renders a zoom slider", () => {
    render(<CropToolbar {...defaultProps} zoom={1.5} />);
    const slider = screen.getByRole("slider", { name: /zoom/i });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue("1.5");
  });

  it("calls onZoomChange when slider changes", async () => {
    const onZoomChange = vi.fn();
    render(<CropToolbar {...defaultProps} onZoomChange={onZoomChange} />);
    const slider = screen.getByRole("slider", { name: /zoom/i });
    // fireEvent is needed for range inputs since userEvent doesn't support them well
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(slider, { target: { value: "2" } });
    expect(onZoomChange).toHaveBeenCalledWith(2);
  });

  it("displays cropped dimensions", () => {
    render(<CropToolbar {...defaultProps} croppedWidth={800} croppedHeight={600} />);
    expect(screen.getByText(/800\s*×\s*600/)).toBeInTheDocument();
  });

  it("renders Nova Imagem button and calls onReset", async () => {
    const onReset = vi.fn();
    render(<CropToolbar {...defaultProps} onReset={onReset} />);
    await userEvent.click(screen.getByRole("button", { name: /nova imagem/i }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("renders Salvar e Baixar button and calls onSave", async () => {
    const onSave = vi.fn();
    render(<CropToolbar {...defaultProps} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /salvar e baixar/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("disables Salvar e Baixar when isSaving is true", () => {
    render(<CropToolbar {...defaultProps} isSaving={true} />);
    expect(screen.getByRole("button", { name: /salvando/i })).toBeDisabled();
  });
});
