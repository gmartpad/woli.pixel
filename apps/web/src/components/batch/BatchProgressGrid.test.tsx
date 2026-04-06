import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { useBatchStore } from "@/stores/batch-store";
import { BatchProgressGrid } from "./BatchProgressGrid";
import type { BatchImage } from "@/stores/batch-store";

beforeAll(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
});

function createImage(status: BatchImage["status"], name = "img.png"): BatchImage {
  return {
    file: new File(["px"], name, { type: "image/png" }),
    uploadId: null,
    status,
    analysis: null,
    selectedTypeId: null,
    qualityScore: null,
    qualityTier: null,
    processedResult: null,
    error: null,
  };
}

function setup(images: BatchImage[], batchStep: string) {
  useBatchStore.setState({
    images,
    batchStep: batchStep as any,
    batchId: null,
    globalTypeId: null,
    globalQualityTier: "medium",
  });
  return render(<BatchProgressGrid />);
}

describe("BatchProgressGrid — weighted progress (Issue 1)", () => {
  beforeEach(() => {
    useBatchStore.setState({
      batchStep: "idle",
      batchId: null,
      images: [],
      globalTypeId: null,
      globalQualityTier: "medium",
    });
  });

  it("shows 0% when all images are pending", () => {
    setup(
      [createImage("pending"), createImage("pending"), createImage("pending")],
      "uploading",
    );
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("shows incremental progress during upload", () => {
    // weights: uploaded=0.30, uploading=0.15, pending=0
    // (0.30 + 0.15 + 0) / 3 = 0.15 → 15%
    setup(
      [createImage("uploaded"), createImage("uploading"), createImage("pending")],
      "uploading",
    );
    expect(screen.getByText("15%")).toBeInTheDocument();
  });

  it("shows progress during analysis", () => {
    // weights: analyzed=0.85, analyzing=0.55, uploaded=0.30
    // (0.85 + 0.55 + 0.30) / 3 = 0.5667 → 57%
    setup(
      [createImage("analyzed"), createImage("analyzing"), createImage("uploaded")],
      "analyzing",
    );
    expect(screen.getByText("57%")).toBeInTheDocument();
  });

  it("shows 100% when all processed", () => {
    setup(
      [createImage("processed"), createImage("processed")],
      "processing",
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("counts error images as 0 progress", () => {
    // weights: analyzed=0.85, error=0, uploading=0.15
    // (0.85 + 0 + 0.15) / 3 = 0.3333 → 33%
    setup(
      [createImage("analyzed"), createImage("error"), createImage("uploading")],
      "uploading",
    );
    expect(screen.getByText("33%")).toBeInTheDocument();
  });
});

describe("BatchProgressGrid — phase labels (Issue 10)", () => {
  beforeEach(() => {
    useBatchStore.setState({
      batchStep: "idle",
      batchId: null,
      images: [],
      globalTypeId: null,
      globalQualityTier: "medium",
    });
  });

  it("shows 'Enviando imagens...' during upload step", () => {
    setup([createImage("uploading")], "uploading");
    expect(screen.getByText("Enviando imagens...")).toBeInTheDocument();
  });

  it("shows 'Analisando imagens...' during analysis step", () => {
    setup([createImage("analyzing")], "analyzing");
    expect(screen.getByText("Analisando imagens...")).toBeInTheDocument();
  });

  it("shows 'Processando imagens...' during processing step", () => {
    setup([createImage("processing")], "processing");
    expect(screen.getByText("Processando imagens...")).toBeInTheDocument();
  });
});

describe("BatchProgressGrid — context-aware counter text", () => {
  beforeEach(() => {
    useBatchStore.setState({
      batchStep: "idle",
      batchId: null,
      images: [],
      globalTypeId: null,
      globalQualityTier: "medium",
    });
  });

  it("shows 'Processando N imagens...' when all images are processing and none completed", () => {
    setup(
      [createImage("processing"), createImage("processing"), createImage("processing"), createImage("processing")],
      "processing",
    );
    expect(screen.getByText("Processando 4 imagens...")).toBeInTheDocument();
  });

  it("shows 'X de Y imagens processadas' when some images have completed", () => {
    setup(
      [createImage("processed"), createImage("processing"), createImage("processing"), createImage("processed")],
      "processing",
    );
    expect(screen.getByText("2 de 4 imagens processadas")).toBeInTheDocument();
  });

  it("shows 'X de Y imagens analisadas' during analyzing step", () => {
    setup(
      [createImage("analyzed"), createImage("analyzing")],
      "analyzing",
    );
    expect(screen.getByText("1 de 2 imagens analisadas")).toBeInTheDocument();
  });

  it("shows 'X de Y imagens enviadas' during uploading step", () => {
    setup(
      [createImage("uploaded"), createImage("uploading"), createImage("pending"), createImage("pending")],
      "uploading",
    );
    expect(screen.getByText("1 de 4 imagens enviadas")).toBeInTheDocument();
  });

  it("counts all post-upload statuses as uploaded", () => {
    setup(
      [createImage("uploaded"), createImage("analyzing"), createImage("analyzed"), createImage("pending")],
      "uploading",
    );
    expect(screen.getByText("3 de 4 imagens enviadas")).toBeInTheDocument();
  });
});

describe("BatchProgressGrid — pulse animation (Issue 9)", () => {
  beforeEach(() => {
    useBatchStore.setState({
      batchStep: "idle",
      batchId: null,
      images: [],
      globalTypeId: null,
      globalQualityTier: "medium",
    });
  });

  it("marks uploading items as aria-busy", () => {
    setup([createImage("uploading", "upload.png")], "uploading");
    const item = screen.getByLabelText("upload.png");
    expect(item).toHaveAttribute("aria-busy", "true");
  });

  it("marks analyzing items as aria-busy", () => {
    setup([createImage("analyzing", "analyze.png")], "analyzing");
    const item = screen.getByLabelText("analyze.png");
    expect(item).toHaveAttribute("aria-busy", "true");
  });

  it("does not mark completed items as aria-busy", () => {
    setup([createImage("analyzed", "done.png")], "analyzing");
    const item = screen.getByLabelText("done.png");
    expect(item).not.toHaveAttribute("aria-busy");
  });
});
