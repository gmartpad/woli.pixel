import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryLightbox } from "./HistoryLightbox";

const defaultProps = {
  imageUrl: "/api/v1/generate/gen-1/download",
  alt: "Test image",
  mode: "single" as const,
  onClose: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
  currentIndex: 0,
  totalItems: 10,
};

describe("HistoryLightbox", () => {
  it("renders image with correct src", () => {
    render(<HistoryLightbox {...defaultProps} />);

    const img = screen.getByRole("img", { name: "Test image" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", expect.stringContaining("/generate/gen-1/download"));
  });

  it("shows position indicator '1 / 10'", () => {
    render(<HistoryLightbox {...defaultProps} />);

    expect(screen.getByText("1 / 10")).toBeInTheDocument();
  });

  it("closes on Escape key", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HistoryLightbox {...defaultProps} onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("navigates with ArrowRight key calling onNext", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<HistoryLightbox {...defaultProps} onNext={onNext} />);

    await user.keyboard("{ArrowRight}");
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("navigates with ArrowLeft key calling onPrev", async () => {
    const user = userEvent.setup();
    const onPrev = vi.fn();
    render(<HistoryLightbox {...defaultProps} onPrev={onPrev} />);

    await user.keyboard("{ArrowLeft}");
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it("has dialog role and aria-modal='true'", () => {
    render(<HistoryLightbox {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("renders comparison slider in compare mode", () => {
    render(
      <HistoryLightbox
        {...defaultProps}
        mode="compare"
        originalImageUrl="/api/v1/uploads/upload-1/download"
      />,
    );

    expect(screen.getByTestId("comparison-slider")).toBeInTheDocument();
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText("Processado")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HistoryLightbox {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
