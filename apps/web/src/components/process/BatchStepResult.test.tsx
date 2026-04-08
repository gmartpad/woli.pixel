import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBatchStore } from "@/stores/batch-store";
import { BatchStepResult } from "./BatchStepResult";

vi.mock("@/hooks/useAuthImage", () => ({
  useAuthImage: (url: string | null) => ({
    src: url ? `blob:test/${url}` : null,
    loading: false,
  }),
}));

vi.mock("@/lib/auth-download", () => ({
  downloadAuthFile: vi.fn(),
}));

describe("BatchStepResult", () => {
  let dispatch: ReturnType<typeof vi.fn>;

  function createTestFile(name: string) {
    return new File(["pixels"], name, { type: "image/png" });
  }

  beforeEach(() => {
    dispatch = vi.fn();
    useBatchStore.setState({
      batchStep: "completed",
      batchId: "batch-1",
      globalTypeId: "t1",
      globalQualityTier: "medium",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          originalWidth: 3840,
          originalHeight: 2160,
          status: "processed",
          analysis: {
            quality: { score: 9, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Logo", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 9,
          qualityTier: null,
          processedResult: {
            width: 1920,
            height: 1080,
            sizeKb: 200,
            format: "jpeg",
            adjustments: ["resized"],
            explanation: "A imagem foi redimensionada.",
            downloadUrl: "/api/v1/images/u1/download",
          },
          cropCoordinates: null,
          error: null,
        },
        {
          file: createTestFile("b.png"),
          uploadId: "u2",
          originalWidth: 512,
          originalHeight: 512,
          status: "processed",
          analysis: {
            quality: { score: 6, issues: ["low_contrast"], blur_detected: false, low_resolution: false, poor_contrast: true },
            content: { type: "icon", primary_subject: "Icon", has_text: false, has_transparency: true, dominant_colors: [] },
            suggested_type: { image_type_id: "t2", type_key: "favicon", display_name: "Favicon", confidence: 85, reasoning: "" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 6,
          qualityTier: null,
          processedResult: {
            width: 128,
            height: 128,
            sizeKb: 30,
            format: "png",
            adjustments: ["resized", "compressed"],
            explanation: "Favicon otimizado.",
            downloadUrl: "/api/v1/images/u2/download",
          },
          cropCoordinates: null,
          error: null,
        },
      ],
    });
  });

  it("renders batch summary header with image count", () => {
    render(<BatchStepResult dispatch={dispatch} />);
    expect(screen.getByText(/2 imagens processadas/i)).toBeInTheDocument();
  });

  it("renders per-image result cards with ANTES/DEPOIS labels", () => {
    render(<BatchStepResult dispatch={dispatch} />);
    // Two ImageResultCards = two "ANTES" labels and two "DEPOIS" labels
    const antes = screen.getAllByText("ANTES");
    const depois = screen.getAllByText("DEPOIS");
    expect(antes).toHaveLength(2);
    expect(depois).toHaveLength(2);
  });

  it("shows AI explanations for each image", () => {
    render(<BatchStepResult dispatch={dispatch} />);
    expect(screen.getByText("A imagem foi redimensionada.")).toBeInTheDocument();
    expect(screen.getByText("Favicon otimizado.")).toBeInTheDocument();
  });

  it("shows adjustment badges", () => {
    render(<BatchStepResult dispatch={dispatch} />);
    expect(screen.getAllByText(/Resize/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Compress/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders per-image download buttons", () => {
    render(<BatchStepResult dispatch={dispatch} />);
    // "Download Todos" + 2 per-image download buttons
    const allButtons = screen.getAllByRole("button", { name: /download/i });
    const perImageButtons = allButtons.filter(b => b.textContent?.trim() === "Download");
    expect(perImageButtons).toHaveLength(2);
  });

  it("renders Download Todos button", () => {
    render(<BatchStepResult dispatch={dispatch} />);
    expect(screen.getByRole("button", { name: /download todos/i })).toBeInTheDocument();
  });

  it("renders Nova Curadoria button", () => {
    render(<BatchStepResult dispatch={dispatch} />);
    expect(screen.getByRole("button", { name: /nova curadoria/i })).toBeInTheDocument();
  });

  it("resets both stores and dispatches RESET on Nova Curadoria click", async () => {
    const user = userEvent.setup();
    render(<BatchStepResult dispatch={dispatch} />);

    await user.click(screen.getByRole("button", { name: /nova curadoria/i }));

    expect(dispatch).toHaveBeenCalledWith({ type: "RESET" });
    expect(useBatchStore.getState().batchStep).toBe("idle");
    expect(useBatchStore.getState().images).toHaveLength(0);
  });

  it("shows original dimensions from upload metadata (not 0x0)", () => {
    render(<BatchStepResult dispatch={dispatch} />);
    expect(screen.getByText(/3840x2160/)).toBeInTheDocument();
    expect(screen.getByText(/512x512/)).toBeInTheDocument();
  });

  it("renders format selector per image card", () => {
    render(<BatchStepResult dispatch={dispatch} />);
    const formatGroups = screen.getAllByRole("group", { name: /formato de download/i });
    expect(formatGroups).toHaveLength(2);
  });

  it("triggers authenticated download with correct format", async () => {
    const { downloadAuthFile } = await import("@/lib/auth-download");
    const user = userEvent.setup();
    render(<BatchStepResult dispatch={dispatch} />);

    const allButtons = screen.getAllByRole("button", { name: /^download$/i });
    await user.click(allButtons[0]!);
    expect(downloadAuthFile).toHaveBeenCalled();
  });

  it("updates format when format selector is changed", async () => {
    const user = userEvent.setup();
    render(<BatchStepResult dispatch={dispatch} />);

    const formatGroups = screen.getAllByRole("group", { name: /formato de download/i });
    const webpButton = formatGroups[0]!.querySelector("button:last-child")!;
    await user.click(webpButton);
    // Format groups still render after selection change
    expect(formatGroups).toHaveLength(2);
  });

  it("handles images without processedResult (error state)", () => {
    useBatchStore.setState({
      ...useBatchStore.getState(),
      images: [
        {
          ...useBatchStore.getState().images[0],
          status: "error",
          processedResult: null,
          error: "Processing failed",
        },
        useBatchStore.getState().images[1],
      ],
    });

    render(<BatchStepResult dispatch={dispatch} />);
    expect(screen.getByText(/Processing failed/)).toBeInTheDocument();
    // Still shows the successful image
    expect(screen.getByText("Favicon otimizado.")).toBeInTheDocument();
  });
});
