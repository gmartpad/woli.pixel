import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessStepResult } from "./ProcessStepResult";
import {
  initialState,
  type ProcessWizardState,
} from "./process-wizard-reducer";

const baseState: ProcessWizardState = {
  ...initialState,
  step: 2,
  uploadId: "upload-1",
  originalImage: {
    url: "blob://original",
    filename: "photo.jpg",
    width: 1920,
    height: 1080,
    sizeKb: 450,
    format: "jpeg",
  },
  selectedTypeId: "type-1",
  result: {
    processed: { width: 800, height: 600, size_kb: 120 },
    adjustments: ["resized", "compressed"],
    explanation: "A imagem foi redimensionada e comprimida com sucesso.",
  },
};

describe("ProcessStepResult", () => {
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
  });

  it("shows before/after comparison images", () => {
    render(<ProcessStepResult state={baseState} dispatch={dispatch} />);
    expect(screen.getByAltText("Original")).toBeInTheDocument();
    expect(screen.getByAltText("Processada")).toBeInTheDocument();
  });

  it("shows ANTES and DEPOIS labels", () => {
    render(<ProcessStepResult state={baseState} dispatch={dispatch} />);
    expect(screen.getByText("ANTES")).toBeInTheDocument();
    expect(screen.getByText("DEPOIS")).toBeInTheDocument();
  });

  it("shows dimension comparison stats", () => {
    render(<ProcessStepResult state={baseState} dispatch={dispatch} />);
    expect(screen.getByText(/1920/)).toBeInTheDocument();
    expect(screen.getByText(/800/)).toBeInTheDocument();
  });

  it("shows size reduction percentage", () => {
    render(<ProcessStepResult state={baseState} dispatch={dispatch} />);
    // 1 - 120/450 = ~73%
    expect(screen.getByText(/-73%/)).toBeInTheDocument();
  });

  it("shows adjustment badges", () => {
    render(<ProcessStepResult state={baseState} dispatch={dispatch} />);
    expect(screen.getByText(/Resize/i)).toBeInTheDocument();
    expect(screen.getByText(/Compress/i)).toBeInTheDocument();
  });

  it("shows AI explanation when present", () => {
    render(<ProcessStepResult state={baseState} dispatch={dispatch} />);
    expect(
      screen.getByText("A imagem foi redimensionada e comprimida com sucesso."),
    ).toBeInTheDocument();
  });

  it("renders a download link", () => {
    render(<ProcessStepResult state={baseState} dispatch={dispatch} />);
    const downloadLink = screen.getByRole("link", { name: /download/i });
    expect(downloadLink.getAttribute("href")).toContain("/api/v1/images/upload-1/download");
  });

  it("renders Nova Imagem button that dispatches RESET", async () => {
    const user = userEvent.setup();
    render(<ProcessStepResult state={baseState} dispatch={dispatch} />);
    await user.click(screen.getByRole("button", { name: /nova imagem/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "RESET" });
  });
});
