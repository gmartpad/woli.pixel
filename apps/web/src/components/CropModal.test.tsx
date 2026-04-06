import { render, screen } from "@testing-library/react";
import { beforeAll, describe, it, expect, vi } from "vitest";
import { computeUpscaleStatus } from "./CropModal";

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof globalThis.ResizeObserver;
  }
});

// ---------------------------------------------------------------------------
// Mock react-image-crop to avoid canvas/DOM dependencies in jsdom
// ---------------------------------------------------------------------------
vi.mock("react-image-crop", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="react-crop">{children}</div>,
  makeAspectCrop: vi.fn(() => ({ unit: "px", x: 0, y: 0, width: 100, height: 100 })),
  centerCrop: vi.fn((crop: unknown) => crop),
}));

// ---------------------------------------------------------------------------
// 1. Pure function tests — computeUpscaleStatus
// ---------------------------------------------------------------------------
describe("computeUpscaleStatus", () => {
  it("returns needsUpscale false when dimensions meet target", () => {
    const result = computeUpscaleStatus(1920, 1080, 1920, 1080);
    expect(result.needsUpscale).toBe(false);
    expect(result.scalePercent).toBe(0);
  });

  it("returns needsUpscale true when width is below target", () => {
    const result = computeUpscaleStatus(960, 1080, 1920, 1080);
    expect(result.needsUpscale).toBe(true);
  });

  it("returns needsUpscale true when height is below target", () => {
    const result = computeUpscaleStatus(1920, 540, 1920, 1080);
    expect(result.needsUpscale).toBe(true);
  });

  it("computes correct scalePercent for undersized crop", () => {
    // 400x300 crop → 1920x1080 target
    // widthRatio = 1920/400 = 4.8, heightRatio = 1080/300 = 3.6
    // maxRatio = 4.8 → scalePercent = round((4.8 - 1) * 100) = 380
    const result = computeUpscaleStatus(400, 300, 1920, 1080);
    expect(result.needsUpscale).toBe(true);
    expect(result.scalePercent).toBe(380);
  });

  it("returns needsUpscale false when targetWidth is null (free aspect)", () => {
    const result = computeUpscaleStatus(400, 300, null, null);
    expect(result.needsUpscale).toBe(false);
    expect(result.scalePercent).toBe(0);
  });

  it("returns needsUpscale false when displayWidth is 0 (no crop yet)", () => {
    const result = computeUpscaleStatus(0, 0, 1920, 1080);
    expect(result.needsUpscale).toBe(false);
    expect(result.scalePercent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Component rendering tests — CropModal
// ---------------------------------------------------------------------------
// We import CropModal lazily so the mock is already in place
const { CropModal } = await import("./CropModal");

const baseProps = {
  imageSrc: "data:image/png;base64,iVBORw0KGgo=",
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  onSkip: vi.fn(),
  targetWidth: 1920,
  targetHeight: 1080,
  typeName: "Fundo Workspace",
};

describe("CropModal component", () => {
  it("confirm button is disabled when no crop is completed", () => {
    render(<CropModal {...baseProps} />);
    const button = screen.getByRole("button", { name: /aplicar e processar/i });
    expect(button).toBeDisabled();
  });

  it("does not show upscale warning when no crop is completed", () => {
    render(<CropModal {...baseProps} />);
    expect(screen.queryByText(/será ampliada/i)).not.toBeInTheDocument();
  });
});
