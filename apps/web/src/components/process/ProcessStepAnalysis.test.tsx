import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProcessStepAnalysis } from "./ProcessStepAnalysis";
import {
  initialState,
  type ProcessWizardState,
} from "./process-wizard-reducer";

const mockFetchImageTypes = vi.fn();
const mockProcessImage = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchImageTypes: (...args: unknown[]) => mockFetchImageTypes(...args),
  processImage: (...args: unknown[]) => mockProcessImage(...args),
}));

let mockCropModalOnConfirm: ((crop: { x: number; y: number; width: number; height: number }) => void) | null = null;
vi.mock("@/components/CropModal", () => ({
  CropModal: (props: { isOpen: boolean; onConfirm: typeof mockCropModalOnConfirm; onClose: () => void; onSkip: () => void }) => {
    mockCropModalOnConfirm = props.onConfirm;
    return props.isOpen ? <div data-testid="crop-modal">CropModal</div> : null;
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

const baseState: ProcessWizardState = {
  ...initialState,
  step: 1,
  uploadId: "upload-1",
  originalImage: {
    url: "blob://test",
    filename: "photo.jpg",
    width: 1920,
    height: 1080,
    sizeKb: 450,
    format: "jpeg",
  },
  analysis: {
    qualityScore: 85,
    contentType: "photo",
    suggestedTypeId: "type-1",
    suggestedTypeName: "Fundo Login",
  },
  crop: null,
};

function renderWithQuery(state: ProcessWizardState, dispatch: ReturnType<typeof vi.fn>) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ProcessStepAnalysis state={state} dispatch={dispatch} />
    </QueryClientProvider>,
  );
}

describe("ProcessStepAnalysis", () => {
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
    mockProcessImage.mockReset();
    mockFetchImageTypes.mockResolvedValue({
      grouped: {
        admin: [
          {
            id: "type-1",
            category: "admin",
            typeKey: "fundo_login",
            displayName: "Fundo Login",
            width: 1920,
            height: 1080,
            aspectRatio: "16:9",
            maxFileSizeKb: 500,
            allowedFormats: ["jpeg", "png"],
            services: null,
          },
        ],
        content: [
          {
            id: "type-2",
            category: "content",
            typeKey: "conteudo_imagem",
            displayName: "Conteúdo Imagem",
            width: 800,
            height: 600,
            aspectRatio: "4:3",
            maxFileSizeKb: 300,
            allowedFormats: ["jpeg", "png", "webp"],
            services: ["resize"],
          },
        ],
      },
    });
  });

  it("shows the original image thumbnail", () => {
    renderWithQuery(baseState, dispatch);
    const img = screen.getByAltText("photo.jpg");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "blob://test");
  });

  it("shows file metadata (filename, dimensions, size)", () => {
    renderWithQuery(baseState, dispatch);
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    expect(screen.getByText(/1920/)).toBeInTheDocument();
    expect(screen.getByText(/1080/)).toBeInTheDocument();
  });

  it("shows AI analysis results when available", () => {
    renderWithQuery(baseState, dispatch);
    expect(screen.getByText(/85/)).toBeInTheDocument();
    // "photo" appears as content type text (exact text node) and in "photo.jpg"
    // Query by the label + value structure
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
    const allPhoto = screen.getAllByText(/photo/i);
    expect(allPhoto.length).toBeGreaterThanOrEqual(2); // filename + content type
    expect(screen.getByText(/Fundo Login/)).toBeInTheDocument();
  });

  it("renders Voltar button that navigates back to step 0", async () => {
    const user = userEvent.setup();
    renderWithQuery(baseState, dispatch);
    const backBtn = screen.getByRole("button", { name: /voltar/i });
    await user.click(backBtn);
    expect(dispatch).toHaveBeenCalledWith({ type: "SET_STEP", step: 0 });
  });

  it("renders Processar Imagem button disabled when no type selected", () => {
    const stateNoType = { ...baseState, selectedTypeId: null };
    renderWithQuery(stateNoType, dispatch);
    const nextBtn = screen.getByRole("button", { name: /processar imagem/i });
    expect(nextBtn).toBeDisabled();
  });

  it("renders Processar Imagem button enabled when a type is selected", () => {
    const stateWithType = { ...baseState, selectedTypeId: "type-1" };
    renderWithQuery(stateWithType, dispatch);
    const nextBtn = screen.getByRole("button", { name: /processar imagem/i });
    expect(nextBtn).not.toBeDisabled();
  });

  it("dispatches SET_TYPE when a type card is clicked", async () => {
    const user = userEvent.setup();
    renderWithQuery(baseState, dispatch);

    // Wait for the type card to appear (React Query async)
    const card = await screen.findByRole("button", { name: /Fundo Login/ });
    await user.click(card);
    expect(dispatch).toHaveBeenCalledWith({ type: "SET_TYPE", typeId: "type-1" });
  });

  // ── Processing (merged from ProcessStepProcess) ──────

  it("shows processing spinner when isProcessing is true", () => {
    const state: ProcessWizardState = { ...baseState, isProcessing: true };
    renderWithQuery(state, dispatch);
    expect(screen.getByText(/Processando imagem/i)).toBeInTheDocument();
  });

  it("clicking Processar Imagem triggers API call and dispatches SET_RESULT on success", async () => {
    const user = userEvent.setup();
    const resultData = {
      processed: { width: 800, height: 600, size_kb: 120 },
      adjustments: ["resized"],
    };
    mockProcessImage.mockResolvedValue(resultData);

    const stateWithType = { ...baseState, selectedTypeId: "type-1" };
    renderWithQuery(stateWithType, dispatch);
    await user.click(screen.getByRole("button", { name: /processar imagem/i }));

    expect(dispatch).toHaveBeenCalledWith({ type: "SET_PROCESSING", value: true });

    await waitFor(() => {
      expect(mockProcessImage).toHaveBeenCalledWith("upload-1", "type-1", undefined);
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: "SET_RESULT",
        result: resultData,
      });
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ type: "SET_STEP", step: 2 });
    });
  });

  it("dispatches SET_ERROR on processing failure", async () => {
    const user = userEvent.setup();
    mockProcessImage.mockRejectedValue(new Error("Processing failed"));

    const stateWithType = { ...baseState, selectedTypeId: "type-1" };
    renderWithQuery(stateWithType, dispatch);
    await user.click(screen.getByRole("button", { name: /processar imagem/i }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: "SET_ERROR",
        error: "Processing failed",
      });
    });
  });

  it("shows error with retry button", () => {
    const state: ProcessWizardState = {
      ...baseState,
      error: "Processing failed",
    };
    renderWithQuery(state, dispatch);
    expect(screen.getByText("Processing failed")).toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
  });

  // ── Manual Crop UI ──────────────────────────────

  it("does not show crop button when no type is selected", () => {
    const state = { ...baseState, selectedTypeId: null };
    renderWithQuery(state, dispatch);
    expect(screen.queryByRole("button", { name: /recortar/i })).not.toBeInTheDocument();
  });

  it("shows crop button when a type is selected", async () => {
    const state = { ...baseState, selectedTypeId: "type-1" };
    renderWithQuery(state, dispatch);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /recortar/i })).toBeInTheDocument();
    });
  });

  it("shows auto-crop label by default", async () => {
    const state = { ...baseState, selectedTypeId: "type-1" };
    renderWithQuery(state, dispatch);
    await waitFor(() => {
      expect(screen.getByText(/auto-crop/i)).toBeInTheDocument();
    });
  });

  it("shows 'Recortado' badge when crop is set", async () => {
    const state: ProcessWizardState = {
      ...baseState,
      selectedTypeId: "type-1",
      crop: { x: 10, y: 20, width: 200, height: 150 },
    };
    renderWithQuery(state, dispatch);
    await waitFor(() => {
      expect(screen.getByText(/recortado/i)).toBeInTheDocument();
    });
  });

  it("Limpar button dispatches CLEAR_CROP", async () => {
    const user = userEvent.setup();
    const state: ProcessWizardState = {
      ...baseState,
      selectedTypeId: "type-1",
      crop: { x: 10, y: 20, width: 200, height: 150 },
    };
    renderWithQuery(state, dispatch);
    const clearBtn = await screen.findByRole("button", { name: /limpar/i });
    await user.click(clearBtn);
    expect(dispatch).toHaveBeenCalledWith({ type: "CLEAR_CROP" });
  });

  it("processImage called WITH crop when crop is set", async () => {
    const user = userEvent.setup();
    const crop = { x: 10, y: 20, width: 200, height: 150 };
    mockProcessImage.mockResolvedValue({ processed: {} });
    const state: ProcessWizardState = {
      ...baseState,
      selectedTypeId: "type-1",
      crop,
    };
    renderWithQuery(state, dispatch);
    await user.click(screen.getByRole("button", { name: /processar imagem/i }));
    await waitFor(() => {
      expect(mockProcessImage).toHaveBeenCalledWith("upload-1", "type-1", crop);
    });
  });

  it("processImage called WITHOUT crop when no crop is set", async () => {
    const user = userEvent.setup();
    mockProcessImage.mockResolvedValue({ processed: {} });
    const state: ProcessWizardState = {
      ...baseState,
      selectedTypeId: "type-1",
      crop: null,
    };
    renderWithQuery(state, dispatch);
    await user.click(screen.getByRole("button", { name: /processar imagem/i }));
    await waitFor(() => {
      expect(mockProcessImage).toHaveBeenCalledWith("upload-1", "type-1", undefined);
    });
  });
});
