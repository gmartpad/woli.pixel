import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessStepUpload } from "./ProcessStepUpload";
import { useBatchStore } from "@/stores/batch-store";
import {
  initialState,
  type ProcessWizardState,
  type ProcessWizardAction,
} from "./process-wizard-reducer";

const mockUploadImage = vi.fn();
vi.mock("@/lib/api", () => ({
  uploadImage: (...args: unknown[]) => mockUploadImage(...args),
}));

function dropFiles(dropZone: HTMLElement, files: File[]) {
  const dataTransfer = {
    files,
    items: files.map((f) => ({ kind: "file", type: f.type, getAsFile: () => f })),
    types: ["Files"],
  };
  fireEvent.drop(dropZone, { dataTransfer });
}

describe("ProcessStepUpload", () => {
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
    mockUploadImage.mockReset();
    useBatchStore.setState({ batchStep: "idle", batchId: null, images: [] });
  });

  // ── Drop zone basics ──────────────────────────

  it("renders the upload drop zone", () => {
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);
    expect(
      screen.getByLabelText(/zona de upload de imagens/i),
    ).toBeInTheDocument();
  });

  it("shows accepted formats hint", () => {
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);
    expect(screen.getByText(/PNG, JPEG, GIF, WebP/)).toBeInTheDocument();
  });

  it("has a multiple attribute on the file input", () => {
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    expect(input.multiple).toBe(true);
  });

  it("shows plural copy text in the upload zone", () => {
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);
    expect(screen.getByText(/imagens/i)).toBeInTheDocument();
  });

  it("shows uploading state when isUploading is true", () => {
    const state: ProcessWizardState = { ...initialState, isUploading: true };
    render(<ProcessStepUpload state={state} dispatch={dispatch} />);
    expect(screen.getByText(/Enviando imagem/i)).toBeInTheDocument();
  });

  it("shows error state with retry button", () => {
    const state: ProcessWizardState = { ...initialState, error: "Erro no upload" };
    render(<ProcessStepUpload state={state} dispatch={dispatch} />);
    expect(screen.getByText("Erro no upload")).toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
  });

  it("rejects files with unsupported type via drag and drop", async () => {
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);

    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });

    dropFiles(dropZone, [file]);

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "SET_ERROR" }),
      );
    });
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  // ── Staging behavior ──────────────────────────

  it("stages a file and shows preview instead of uploading immediately", async () => {
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);

    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);
    const file = new File(["pixels"], "photo.png", { type: "image/png" });

    dropFiles(dropZone, [file]);

    // File is staged, not uploaded
    expect(mockUploadImage).not.toHaveBeenCalled();
    // Preview should show filename
    expect(screen.getByText("photo.png")).toBeInTheDocument();
    // Continue button should appear
    expect(screen.getByRole("button", { name: /continuar/i })).toBeInTheDocument();
  });

  it("accumulates files across multiple drops", async () => {
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);

    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);

    // First drop — 1 file
    dropFiles(dropZone, [new File(["px1"], "a.png", { type: "image/png" })]);
    expect(screen.getByText("a.png")).toBeInTheDocument();

    // Second drop — another file
    dropFiles(dropZone, [new File(["px2"], "b.png", { type: "image/png" })]);
    expect(screen.getByText("a.png")).toBeInTheDocument();
    expect(screen.getByText("b.png")).toBeInTheDocument();
  });

  it("allows removing a staged file", async () => {
    const user = userEvent.setup();
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);

    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);
    dropFiles(dropZone, [
      new File(["px1"], "a.png", { type: "image/png" }),
      new File(["px2"], "b.png", { type: "image/png" }),
    ]);

    const removeButtons = screen.getAllByLabelText(/remover/i);
    await user.click(removeButtons[0]);

    expect(screen.queryByText("a.png")).not.toBeInTheDocument();
    expect(screen.getByText("b.png")).toBeInTheDocument();
  });

  it("returns to empty drop zone when all staged files are removed", async () => {
    const user = userEvent.setup();
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);

    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);
    dropFiles(dropZone, [new File(["px1"], "a.png", { type: "image/png" })]);

    const removeButton = screen.getByLabelText(/remover/i);
    await user.click(removeButton);

    // Back to the empty drop zone
    expect(screen.queryByRole("button", { name: /continuar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Arraste imagens/i)).toBeInTheDocument();
  });

  it("does not stage duplicate filenames", () => {
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);

    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);
    dropFiles(dropZone, [new File(["px1"], "a.png", { type: "image/png" })]);
    dropFiles(dropZone, [new File(["px2"], "a.png", { type: "image/png" })]);

    // Should only have one entry
    expect(screen.getAllByText("a.png")).toHaveLength(1);
  });

  // ── Continue: single-file flow ────────────────

  it("uploads single file and advances on Continuar click", async () => {
    const user = userEvent.setup();
    mockUploadImage.mockResolvedValue({
      id: "upload-1",
      filename: "test.png",
      width: 800,
      height: 600,
      sizeKb: 150,
      format: "png",
    });

    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);

    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);
    dropFiles(dropZone, [new File(["pixels"], "test.png", { type: "image/png" })]);

    await user.click(screen.getByRole("button", { name: /continuar/i }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ type: "SET_UPLOADING", value: true });
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "SET_FILE", uploadId: "upload-1" }),
      );
    });
    expect(dispatch).not.toHaveBeenCalledWith({ type: "SET_BATCH_MODE" });
  });

  it("dispatches SET_ERROR on upload failure after Continuar", async () => {
    const user = userEvent.setup();
    mockUploadImage.mockRejectedValue(new Error("Network error"));

    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);

    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);
    dropFiles(dropZone, [new File(["pixels"], "test.png", { type: "image/png" })]);

    await user.click(screen.getByRole("button", { name: /continuar/i }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: "SET_ERROR",
        error: "Network error",
      });
    });
  });

  // ── Skeleton loading ─────────────────────────

  it("shows skeleton placeholder before image loads", () => {
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);
    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);
    dropFiles(dropZone, [new File(["px"], "a.png", { type: "image/png" })]);

    expect(screen.getByTestId("skeleton-0")).toBeInTheDocument();
  });

  it("shows a loading spinner inside the skeleton placeholder", () => {
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);
    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);
    dropFiles(dropZone, [new File(["px"], "a.png", { type: "image/png" })]);

    const skeleton = screen.getByTestId("skeleton-0");
    expect(within(skeleton).getByRole("status")).toBeInTheDocument();
  });

  it("hides skeleton after image loads", async () => {
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);
    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);
    dropFiles(dropZone, [new File(["px"], "a.png", { type: "image/png" })]);

    const img = screen.getByAltText("a.png");
    fireEvent.load(img);

    await waitFor(() => {
      expect(screen.queryByTestId("skeleton-0")).not.toBeInTheDocument();
    });
  });

  // ── Continue: batch flow ──────────────────────

  it("dispatches SET_BATCH_MODE for multiple staged files on Continuar", async () => {
    const user = userEvent.setup();
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);

    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);

    // Accumulate files across TWO separate drops
    dropFiles(dropZone, [new File(["px1"], "a.png", { type: "image/png" })]);
    dropFiles(dropZone, [new File(["px2"], "b.png", { type: "image/png" })]);

    await user.click(screen.getByRole("button", { name: /continuar/i }));

    expect(dispatch).toHaveBeenCalledWith({ type: "SET_BATCH_MODE" });
    expect(useBatchStore.getState().images).toHaveLength(2);
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it("dispatches SET_BATCH_MODE when multiple files dropped at once", async () => {
    const user = userEvent.setup();
    render(<ProcessStepUpload state={initialState} dispatch={dispatch} />);

    const dropZone = screen.getByLabelText(/zona de upload de imagens/i);
    dropFiles(dropZone, [
      new File(["px1"], "a.png", { type: "image/png" }),
      new File(["px2"], "b.png", { type: "image/png" }),
    ]);

    await user.click(screen.getByRole("button", { name: /continuar/i }));

    expect(dispatch).toHaveBeenCalledWith({ type: "SET_BATCH_MODE" });
    expect(useBatchStore.getState().images).toHaveLength(2);
  });
});
