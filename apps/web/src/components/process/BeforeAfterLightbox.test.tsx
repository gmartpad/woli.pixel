import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BeforeAfterLightbox } from "./BeforeAfterLightbox";

const defaultProps = {
  originalSrc: "blob://original",
  processedSrc: "/api/v1/images/upload-1/download",
  initialSlide: 0 as const,
  onClose: vi.fn(),
};

describe("BeforeAfterLightbox", () => {
  // --- Rendering ---

  it("renders a dialog with role=dialog and aria-modal=true", () => {
    render(<BeforeAfterLightbox {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("renders a close button with aria-label Fechar", () => {
    render(<BeforeAfterLightbox {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });

  it("shows ANTES label and original image when initialSlide=0", () => {
    render(<BeforeAfterLightbox {...defaultProps} initialSlide={0} />);
    expect(screen.getByText("ANTES")).toBeInTheDocument();
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "blob://original");
  });

  it("shows DEPOIS label and processed image when initialSlide=1", () => {
    render(<BeforeAfterLightbox {...defaultProps} initialSlide={1} />);
    expect(screen.getByText("DEPOIS")).toBeInTheDocument();
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/api/v1/images/upload-1/download");
  });

  it("renders two dot indicators with the active one highlighted", () => {
    render(<BeforeAfterLightbox {...defaultProps} initialSlide={0} />);
    const dots = screen.getAllByTestId("dot-indicator");
    expect(dots).toHaveLength(2);
    expect(dots[0]!.className).toContain("bg-white");
    expect(dots[1]!.className).toContain("bg-white/30");
  });

  // --- Navigation ---

  it("next arrow navigates from ANTES to DEPOIS", async () => {
    const user = userEvent.setup();
    render(<BeforeAfterLightbox {...defaultProps} initialSlide={0} />);
    expect(screen.getByText("ANTES")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByText("DEPOIS")).toBeInTheDocument();
  });

  it("prev arrow navigates from DEPOIS to ANTES", async () => {
    const user = userEvent.setup();
    render(<BeforeAfterLightbox {...defaultProps} initialSlide={1} />);
    expect(screen.getByText("DEPOIS")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByText("ANTES")).toBeInTheDocument();
  });

  it("clicking dot-1 navigates to DEPOIS", async () => {
    const user = userEvent.setup();
    render(<BeforeAfterLightbox {...defaultProps} initialSlide={0} />);

    const dots = screen.getAllByTestId("dot-indicator");
    await user.click(dots[1]!);
    expect(screen.getByText("DEPOIS")).toBeInTheDocument();
  });

  it("wraps around: next on DEPOIS goes to ANTES", async () => {
    const user = userEvent.setup();
    render(<BeforeAfterLightbox {...defaultProps} initialSlide={1} />);

    await user.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByText("ANTES")).toBeInTheDocument();
  });

  // --- Keyboard ---

  it("Escape calls onClose", () => {
    const onClose = vi.fn();
    render(<BeforeAfterLightbox {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ArrowRight navigates to DEPOIS", () => {
    render(<BeforeAfterLightbox {...defaultProps} initialSlide={0} />);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("DEPOIS")).toBeInTheDocument();
  });

  it("ArrowLeft navigates to ANTES", () => {
    render(<BeforeAfterLightbox {...defaultProps} initialSlide={1} />);
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("ANTES")).toBeInTheDocument();
  });

  // --- Close ---

  it("close button calls onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BeforeAfterLightbox {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("backdrop click calls onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BeforeAfterLightbox {...defaultProps} onClose={onClose} />);

    const dialog = screen.getByRole("dialog");
    await user.click(dialog);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
