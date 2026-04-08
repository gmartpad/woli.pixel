import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBatchStore } from "@/stores/batch-store";
import { BatchStepAnalysis } from "./BatchStepAnalysis";

const mockCreateBatch = vi.fn();
const mockUploadToBatch = vi.fn();
const mockAnalyzeBatch = vi.fn();
const mockGetBatch = vi.fn();
const mockFetchImageTypes = vi.fn();
const mockProcessBatch = vi.fn();

vi.mock("@/components/CropModal", () => ({
  CropModal: ({ isOpen, onConfirm, onClose }: { isOpen: boolean; onConfirm: (c: any) => void; onClose: () => void; onSkip: () => void; imageSrc: string; targetWidth: number | null; targetHeight: number | null; typeName: string }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="crop-modal">
        <button onClick={() => onConfirm({ x: 10, y: 20, width: 100, height: 80 })}>Aplicar e Processar</button>
        <button onClick={onClose}>Cancelar</button>
      </div>
    );
  },
}));

vi.mock("@/lib/api", () => ({
  createBatch: (...args: unknown[]) => mockCreateBatch(...args),
  uploadToBatch: (...args: unknown[]) => mockUploadToBatch(...args),
  analyzeBatch: (...args: unknown[]) => mockAnalyzeBatch(...args),
  getBatch: (...args: unknown[]) => mockGetBatch(...args),
  fetchImageTypes: (...args: unknown[]) => mockFetchImageTypes(...args),
  processBatch: (...args: unknown[]) => mockProcessBatch(...args),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderWithProviders(dispatch: ReturnType<typeof vi.fn>) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <BatchStepAnalysis dispatch={dispatch} />
    </QueryClientProvider>,
  );
}

function createTestFile(name: string) {
  return new File(["pixels"], name, { type: "image/png" });
}

describe("BatchStepAnalysis", () => {
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
    mockCreateBatch.mockReset();
    mockUploadToBatch.mockReset();
    mockAnalyzeBatch.mockReset();
    mockGetBatch.mockReset();
    mockProcessBatch.mockReset();
    mockFetchImageTypes.mockResolvedValue({
      grouped: {
        admin: [
          {
            id: "t1",
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
            id: "t2",
            category: "content",
            typeKey: "conteudo_imagem",
            displayName: "Conteúdo Imagem",
            width: 800,
            height: 600,
            aspectRatio: "4:3",
            maxFileSizeKb: 10240,
            allowedFormats: ["jpeg", "png", "webp"],
            services: ["resize"],
          },
        ],
      },
      types: [
        { id: "t1", displayName: "Fundo Login", typeKey: "fundo_login", width: 1920, height: 1080 },
        { id: "t2", displayName: "Conteúdo Imagem", typeKey: "conteudo_imagem", width: 800, height: 600 },
      ],
    });
    useBatchStore.setState({
      batchStep: "selecting",
      batchId: null,
      images: [],
      globalTypeId: null,
      globalQualityTier: "medium",
      assignmentMode: "global",
    });
  });

  it("renders file count on mount", () => {
    useBatchStore.getState().addFiles([createTestFile("a.png"), createTestFile("b.png")]);
    // Mock to prevent auto-start errors
    mockCreateBatch.mockResolvedValue({ id: "batch-1" });
    mockUploadToBatch.mockResolvedValue({ id: "upload-1" });
    mockAnalyzeBatch.mockResolvedValue({});
    mockGetBatch.mockResolvedValue({ images: [] });

    renderWithProviders(dispatch);

    expect(screen.getByText(/2 imagens/i)).toBeInTheDocument();
  });

  it("auto-starts analysis when mounted with files in selecting state", async () => {
    useBatchStore.getState().addFiles([createTestFile("a.png")]);
    mockCreateBatch.mockResolvedValue({ id: "batch-1" });
    mockUploadToBatch.mockResolvedValue({ id: "upload-1", filename: "a.png", width: 800, height: 600 });
    mockAnalyzeBatch.mockResolvedValue({});
    mockGetBatch.mockResolvedValue({
      images: [{ id: "upload-1", filename: "a.png", status: "analyzed",
        analysis: { quality: { score: 8, issues: [] }, suggested_type: { image_type_id: "t1", display_name: "Fundo Login" } }
      }],
    });

    renderWithProviders(dispatch);

    // Should auto-start — no button click needed
    await waitFor(() => { expect(mockCreateBatch).toHaveBeenCalled(); });
    await waitFor(() => { expect(mockUploadToBatch).toHaveBeenCalledWith("batch-1", expect.any(File)); });
    await waitFor(() => { expect(mockAnalyzeBatch).toHaveBeenCalledWith("batch-1"); });
  });

  it("matches analysis results by uploadId even when server returns images in different order", async () => {
    useBatchStore.getState().addFiles([createTestFile("a.png"), createTestFile("b.png")]);

    mockCreateBatch.mockResolvedValue({ id: "batch-1" });
    mockUploadToBatch
      .mockResolvedValueOnce({ id: "upload-A", filename: "a.png", width: 800, height: 600 })
      .mockResolvedValueOnce({ id: "upload-B", filename: "b.png", width: 400, height: 300 });
    mockAnalyzeBatch.mockResolvedValue({});
    // Server returns images in REVERSED order (upload-B first)
    mockGetBatch.mockResolvedValue({
      images: [
        {
          id: "upload-B",
          filename: "b.png",
          status: "analyzed",
          analysis: {
            quality: { score: 5, issues: ["blurry"] },
            suggested_type: { image_type_id: "t2", display_name: "Conteúdo Imagem" },
          },
        },
        {
          id: "upload-A",
          filename: "a.png",
          status: "analyzed",
          analysis: {
            quality: { score: 9, issues: [] },
            suggested_type: { image_type_id: "t1", display_name: "Fundo Login" },
          },
        },
      ],
    });

    renderWithProviders(dispatch);

    await waitFor(() => {
      const images = useBatchStore.getState().images;
      // Image 0 (uploadId=upload-A) should get score 9, NOT score 5
      expect(images[0].qualityScore).toBe(9);
      // Image 1 (uploadId=upload-B) should get score 5, NOT score 9
      expect(images[1].qualityScore).toBe(5);
    }, { timeout: 3000 });
  });

  it("does not render a manual start analysis button", () => {
    useBatchStore.getState().addFiles([createTestFile("a.png")]);
    // Mock to prevent auto-start errors
    mockCreateBatch.mockResolvedValue({ id: "batch-1" });
    mockUploadToBatch.mockResolvedValue({ id: "upload-1" });
    mockAnalyzeBatch.mockResolvedValue({});
    mockGetBatch.mockResolvedValue({ images: [] });

    renderWithProviders(dispatch);

    expect(screen.queryByRole("button", { name: /iniciar análise/i })).not.toBeInTheDocument();
  });

  it("orchestrates batch creation, upload, and analysis on mount", async () => {
    useBatchStore.getState().addFiles([createTestFile("a.png")]);

    mockCreateBatch.mockResolvedValue({ id: "batch-1" });
    mockUploadToBatch.mockResolvedValue({
      id: "upload-1",
      filename: "a.png",
      width: 800,
      height: 600,
    });
    mockAnalyzeBatch.mockResolvedValue({});
    mockGetBatch.mockResolvedValue({
      images: [
        {
          id: "upload-1",
          filename: "a.png",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [] },
            suggested_type: { image_type_id: "t1", display_name: "Fundo Login" },
          },
        },
      ],
    });

    renderWithProviders(dispatch);

    // Auto-triggers without button click
    await waitFor(() => {
      expect(mockCreateBatch).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockUploadToBatch).toHaveBeenCalledWith("batch-1", expect.any(File));
    });

    await waitFor(() => {
      expect(mockAnalyzeBatch).toHaveBeenCalledWith("batch-1");
    });
  });

  it("shows empty state when no files", () => {
    renderWithProviders(dispatch);
    expect(screen.queryByRole("button", { name: /iniciar análise/i })).not.toBeInTheDocument();
    expect(screen.getByText(/nenhuma imagem/i)).toBeInTheDocument();
  });

  it("shows TypeSelector after analysis completes (reviewed state)", async () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      globalQualityTier: "medium",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);

    // TypeSelector renders "Seleção de Tipo" heading
    expect(screen.getByText("Seleção de Tipo")).toBeInTheDocument();
  });

  it("shows per-image type override dropdown in reviewed state (per-image mode)", async () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      globalQualityTier: "medium",
      assignmentMode: "per-image",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);

    // Per-image type override select (only visible in per-image mode)
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  it("sets globalTypeId via TypeSelector and enables Processar Lote", async () => {
    const user = userEvent.setup();
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      globalQualityTier: "medium",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);

    // Continuar button should be disabled until globalTypeId is set
    const continueBtn = screen.getByRole("button", { name: /processar lote/i });
    expect(continueBtn).toBeDisabled();

    // Click a type card in TypeSelector
    const typeCard = await screen.findByRole("button", { name: /fundo login/i });
    await user.click(typeCard);

    expect(useBatchStore.getState().globalTypeId).toBe("t1");
  });

  // ── Issue 6: Hide duplicate thumbnail grid ──────

  it("hides top thumbnail grid in reviewed state", () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      globalQualityTier: "medium",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    expect(screen.queryByText(/1 imagens selecionadas/i)).not.toBeInTheDocument();
  });

  // ── Issue 5: Sticky Continuar button ──────

  it("renders Processar Lote in a sticky container", () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: "t1",
      globalQualityTier: "medium",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    const btn = screen.getByRole("button", { name: /processar lote/i });
    expect(btn.parentElement?.className).toContain("sticky");
  });

  // ── Issue 8: Dynamic "Global" label ──────

  it("shows global type name in default dropdown option", async () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: "t1",
      globalQualityTier: "medium",
      assignmentMode: "per-image",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    // Wait for React Query to resolve types data
    await waitFor(() => {
      const select = screen.getAllByRole("combobox")[0];
      const defaultOption = select?.querySelector("option[value='']");
      expect(defaultOption?.textContent).toContain("Fundo Login");
    });
  });

  it("shows 'Tipo Global' when no global type selected", async () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      globalQualityTier: "medium",
      assignmentMode: "per-image",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    await waitFor(() => {
      const select = screen.getAllByRole("combobox")[0];
      const defaultOption = select?.querySelector("option[value='']");
      expect(defaultOption?.textContent).toBe("Tipo Global");
    });
  });

  // ── Issue 7: Grouped optgroup dropdown ──────

  it("renders per-image dropdown with category optgroups", async () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      globalQualityTier: "medium",
      assignmentMode: "per-image",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    await waitFor(() => {
      const select = screen.getAllByRole("combobox")[0];
      const optgroups = select?.querySelectorAll("optgroup");
      expect(optgroups?.length).toBeGreaterThanOrEqual(1);
      const labels = Array.from(optgroups ?? []).map((og) => og.getAttribute("label"));
      expect(labels).toContain("Admin / Branding");
    });
  });

  // ── Issue 3: Expanded AI analysis in review rows ──────

  it("shows quality score as prominent badge", () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: "t1",
      globalQualityTier: "medium",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    expect(screen.getByText("8/10")).toBeInTheDocument();
  });

  it("shows quality issues as chips", () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: "t1",
      globalQualityTier: "medium",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 4, issues: ["Baixa resolução"], blur_detected: false, low_resolution: true, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 4,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    expect(screen.getByText("Baixa resolução")).toBeInTheDocument();
  });

  it("shows content type label", () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: "t1",
      globalQualityTier: "medium",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    expect(screen.getByText("Foto")).toBeInTheDocument();
  });

  it("shows blur warning when detected", () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: "t1",
      globalQualityTier: "medium",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 3, issues: ["Desfocada"], blur_detected: true, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 3,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    expect(screen.getByText("Desfocada")).toBeInTheDocument();
  });

  it("hides warnings when quality is clean", () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      globalQualityTier: "medium",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 9, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 9,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    expect(screen.queryByText("Desfocada")).not.toBeInTheDocument();
    expect(screen.queryByText("Baixa resolução")).not.toBeInTheDocument();
  });

  // ── Issue 2: Transition delay ──────

  it("sets images to analyzed before advancing to reviewed", async () => {
    useBatchStore.getState().addFiles([createTestFile("a.png")]);

    mockCreateBatch.mockResolvedValue({ id: "batch-1" });
    mockUploadToBatch.mockResolvedValue({ id: "upload-1" });
    mockAnalyzeBatch.mockResolvedValue({});
    mockGetBatch.mockResolvedValue({
      images: [{
        id: "upload-1",
        filename: "a.png",
        status: "analyzed",
        analysis: {
          quality: { score: 8, issues: [] },
          suggested_type: { image_type_id: "t1", display_name: "Fundo Login" },
        },
      }],
    });

    renderWithProviders(dispatch);

    // Eventually transitions to reviewed
    await waitFor(() => {
      expect(useBatchStore.getState().batchStep).toBe("reviewed");
    }, { timeout: 3000 });

    // All images should be analyzed by the time we reach reviewed
    const state = useBatchStore.getState();
    const allAnalyzed = state.images.every((i) => i.status === "analyzed" || i.status === "processed");
    expect(allAnalyzed).toBe(true);
  });

  it("transitions to reviewed after analysis pipeline completes", async () => {
    useBatchStore.getState().addFiles([createTestFile("a.png")]);

    mockCreateBatch.mockResolvedValue({ id: "batch-1" });
    mockUploadToBatch.mockResolvedValue({ id: "upload-1" });
    mockAnalyzeBatch.mockResolvedValue({});
    mockGetBatch.mockResolvedValue({
      images: [{
        id: "upload-1",
        filename: "a.png",
        status: "analyzed",
        analysis: {
          quality: { score: 8, issues: [] },
          suggested_type: { image_type_id: "t1", display_name: "Fundo Login" },
        },
      }],
    });

    renderWithProviders(dispatch);

    // Should eventually reach reviewed state (after 800ms delay)
    await waitFor(() => {
      expect(useBatchStore.getState().batchStep).toBe("reviewed");
    }, { timeout: 3000 });
  });

  // ── Issue 4-caller: Pass suggestedTypeId to TypeSelector ──────

  it("passes most common suggested type to TypeSelector", async () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      globalQualityTier: "medium",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
        {
          file: createTestFile("b.png"),
          uploadId: "u2",
          status: "analyzed",
          analysis: {
            quality: { score: 7, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "People", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 85, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 7,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
        {
          file: createTestFile("c.png"),
          uploadId: "u3",
          status: "analyzed",
          analysis: {
            quality: { score: 6, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "illustration", primary_subject: "Icon", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t2", type_key: "conteudo_imagem", display_name: "Conteúdo Imagem", confidence: 70, reasoning: "Illustration" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 6,
          qualityTier: null,
          processedResult: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);

    // t1 is suggested by 2 out of 3 images → "Sugerido pela IA" badge should be on Fundo Login
    await waitFor(() => {
      expect(screen.getByText("Sugerido pela IA")).toBeInTheDocument();
    });
  });

  // ── Segmented Control: assignment mode ──────

  const reviewedImage = {
    file: createTestFile("a.png"),
    uploadId: "u1",
    status: "analyzed" as const,
    analysis: {
      quality: { score: 8, issues: [] as string[], blur_detected: false, low_resolution: false, poor_contrast: false },
      content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] as string[] },
      suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
      crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
    },
    selectedTypeId: null,
    qualityScore: 8,
    qualityTier: null as "low" | "medium" | "high" | null,
    processedResult: null,
    autoMatchScore: null,
    cropCoordinates: null,
    error: null,
  };

  function setReviewedState(overrides: Record<string, unknown> = {}) {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      globalQualityTier: "medium",
      assignmentMode: "global",
      images: [reviewedImage],
      ...overrides,
    });
  }

  it("renders segmented control with two mode buttons in reviewed state", () => {
    setReviewedState();
    renderWithProviders(dispatch);
    expect(screen.getByRole("button", { name: /aplicar para todos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /personalizar/i })).toBeInTheDocument();
  });

  it("defaults to 'Aplicar para todos' mode", () => {
    setReviewedState();
    renderWithProviders(dispatch);
    expect(useBatchStore.getState().assignmentMode).toBe("global");
  });

  it("shows helper text for global mode", () => {
    setReviewedState();
    renderWithProviders(dispatch);
    expect(screen.getByText(/selecione o tipo para todas as/i)).toBeInTheDocument();
  });

  it("shows TypeSelector in global mode", () => {
    setReviewedState();
    renderWithProviders(dispatch);
    expect(screen.getByText("Seleção de Tipo")).toBeInTheDocument();
  });

  it("hides per-image dropdowns in global mode", () => {
    setReviewedState();
    renderWithProviders(dispatch);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("still shows per-image analysis info in global mode", () => {
    setReviewedState({ globalTypeId: "t1" });
    renderWithProviders(dispatch);
    expect(screen.getByText("8/10")).toBeInTheDocument();
    expect(screen.getByText("Foto")).toBeInTheDocument();
  });

  it("switches to per-image mode on click", async () => {
    const user = userEvent.setup();
    setReviewedState();
    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /personalizar/i }));
    expect(useBatchStore.getState().assignmentMode).toBe("per-image");
  });

  it("calls prefillPerImageTypes when switching to per-image mode", async () => {
    const user = userEvent.setup();
    setReviewedState();
    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /personalizar/i }));
    // AI suggestion is t1, so selectedTypeId should be prefilled
    expect(useBatchStore.getState().images[0].selectedTypeId).toBe("t1");
  });

  it("shows per-image dropdowns in per-image mode", async () => {
    setReviewedState({ assignmentMode: "per-image" });
    renderWithProviders(dispatch);
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(1);
  });

  it("hides TypeSelector in per-image mode", () => {
    setReviewedState({ assignmentMode: "per-image" });
    renderWithProviders(dispatch);
    expect(screen.queryByText("Seleção de Tipo")).not.toBeInTheDocument();
  });

  it("disables Processar Lote in per-image mode when some images have no type", () => {
    setReviewedState({ assignmentMode: "per-image" });
    renderWithProviders(dispatch);
    expect(screen.getByRole("button", { name: /processar lote/i })).toBeDisabled();
    expect(screen.getByText(/1 imagem sem tipo/i)).toBeInTheDocument();
  });

  it("enables Processar Lote in per-image mode when all images have a type", () => {
    setReviewedState({
      assignmentMode: "per-image",
      images: [{ ...reviewedImage, selectedTypeId: "t1" }],
    });
    renderWithProviders(dispatch);
    expect(screen.getByRole("button", { name: /processar lote/i })).not.toBeDisabled();
  });

  // ── Issue P1: ThumbnailCell loading spinners ──────

  it("renders pulse skeleton behind each thumbnail in pre-review grid", () => {
    useBatchStore.setState({
      batchStep: "uploading",
      batchId: "batch-1",
      images: [
        { ...reviewedImage, status: "uploading" },
        { ...reviewedImage, file: createTestFile("b.png"), status: "uploading" },
      ],
    });
    renderWithProviders(dispatch);
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });

  it("hides skeleton after image onLoad fires", () => {
    useBatchStore.setState({
      batchStep: "uploading",
      batchId: "batch-1",
      images: [{ ...reviewedImage, status: "uploading" }],
    });
    renderWithProviders(dispatch);
    // ThumbnailCell skeleton has both animate-pulse and absolute classes
    expect(document.querySelector(".animate-pulse.absolute")).toBeInTheDocument();

    const img = screen.getByAltText("a.png");
    fireEvent.load(img);

    expect(document.querySelector(".animate-pulse.absolute")).not.toBeInTheDocument();
  });

  it("review row thumbnails also show skeleton while loading", () => {
    setReviewedState({ globalTypeId: "t1" });
    renderWithProviders(dispatch);
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Issue P2: Missing-type indicator in Personalizar mode ──────

  it("per-image row has warning styling when type is not assigned", () => {
    setReviewedState({ assignmentMode: "per-image" });
    renderWithProviders(dispatch);
    const filename = screen.getByText("a.png");
    // filename <p> → parent <div flex-1> → grandparent is the row div
    const row = filename.parentElement!.parentElement!;
    expect(row.className).toMatch(/border-warning/);
  });

  it("per-image row has normal styling when type is assigned", () => {
    setReviewedState({
      assignmentMode: "per-image",
      images: [{ ...reviewedImage, selectedTypeId: "t1" }],
    });
    renderWithProviders(dispatch);
    const filename = screen.getByText("a.png");
    const row = filename.parentElement!.parentElement!;
    expect(row.className).not.toMatch(/border-warning/);
  });

  it("renders aggregate missing-type banner above review list", () => {
    setReviewedState({ assignmentMode: "per-image" });
    renderWithProviders(dispatch);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/1 imagem sem tipo selecionado/i)).toBeInTheDocument();
  });

  it("hides aggregate banner when all images have types", () => {
    setReviewedState({
      assignmentMode: "per-image",
      images: [{ ...reviewedImage, selectedTypeId: "t1" }],
    });
    renderWithProviders(dispatch);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("select dropdown has warning border when unassigned", () => {
    setReviewedState({ assignmentMode: "per-image" });
    renderWithProviders(dispatch);
    const select = screen.getAllByRole("combobox")[0];
    expect(select.className).toMatch(/border-warning/);
  });

  // ── Issue P3: Crop button + CropModal integration ──────

  it("renders crop button per image row when type is assigned", () => {
    setReviewedState({
      assignmentMode: "per-image",
      images: [{ ...reviewedImage, selectedTypeId: "t1" }],
    });
    renderWithProviders(dispatch);
    expect(screen.getByRole("button", { name: /recortar a\.png/i })).toBeInTheDocument();
  });

  it("crop button is disabled when no type is assigned", () => {
    setReviewedState({ assignmentMode: "per-image" });
    renderWithProviders(dispatch);
    expect(screen.getByRole("button", { name: /recortar a\.png/i })).toBeDisabled();
  });

  it("crop button is present in global mode when globalTypeId is set", () => {
    setReviewedState({ globalTypeId: "t1" });
    renderWithProviders(dispatch);
    expect(screen.getByRole("button", { name: /recortar a\.png/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recortar a\.png/i })).not.toBeDisabled();
  });

  it("clicking crop button opens CropModal", async () => {
    const user = userEvent.setup();
    setReviewedState({
      assignmentMode: "per-image",
      images: [{ ...reviewedImage, selectedTypeId: "t1" }],
    });
    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /recortar a\.png/i }));
    expect(screen.getByTestId("crop-modal")).toBeInTheDocument();
  });

  it("confirming crop stores coordinates in batch store", async () => {
    const user = userEvent.setup();
    setReviewedState({
      assignmentMode: "per-image",
      images: [{ ...reviewedImage, selectedTypeId: "t1" }],
    });
    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /recortar a\.png/i }));
    await user.click(screen.getByRole("button", { name: /aplicar e processar/i }));
    expect(useBatchStore.getState().images[0].cropCoordinates).toEqual({ x: 10, y: 20, width: 100, height: 80 });
  });

  it("shows Recortado badge when cropCoordinates is set", () => {
    setReviewedState({
      globalTypeId: "t1",
      images: [{ ...reviewedImage, selectedTypeId: "t1", cropCoordinates: { x: 10, y: 20, width: 100, height: 80 } }],
    });
    renderWithProviders(dispatch);
    expect(screen.getByText("Recortado")).toBeInTheDocument();
  });

  // ── Processing (merged from BatchStepProcess) ──────

  const fullAnalysis = {
    quality: { score: 8, issues: [] as string[], blur_detected: false, low_resolution: false, poor_contrast: false },
    content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] as string[] },
    suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
    crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
  };

  function setProcessReadyState(overrides: Record<string, unknown> = {}) {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: "t1",
      globalQualityTier: "medium",
      assignmentMode: "global",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          status: "analyzed",
          analysis: fullAnalysis,
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          autoMatchScore: null,
          cropCoordinates: null,
          error: null,
        },
        {
          file: createTestFile("b.png"),
          uploadId: "u2",
          status: "analyzed",
          analysis: { ...fullAnalysis, quality: { ...fullAnalysis.quality, score: 5 } },
          selectedTypeId: "t2",
          qualityScore: 5,
          qualityTier: null,
          processedResult: null,
          autoMatchScore: null,
          cropCoordinates: null,
          error: null,
        },
      ],
      ...overrides,
    });
  }

  it("calls processBatch with overrides and advances to step 2", async () => {
    const user = userEvent.setup();
    setProcessReadyState();

    mockProcessBatch.mockResolvedValue({});
    // First poll: still processing (backend hasn't finished)
    mockGetBatch.mockResolvedValueOnce({
      status: "processing",
      images: [
        { id: "u1", status: "processing" },
        { id: "u2", status: "processing" },
      ],
    });
    // Second poll: all processed
    mockGetBatch.mockResolvedValueOnce({
      status: "processed",
      images: [
        {
          id: "u1",
          status: "processed",
          processedWidth: 1920,
          processedHeight: 1080,
          processedSizeKb: 200,
          processedFormat: "jpeg",
          adjustments: ["resized"],
          explanation: "Resized to target.",
        },
        {
          id: "u2",
          status: "processed",
          processedWidth: 128,
          processedHeight: 128,
          processedSizeKb: 30,
          processedFormat: "png",
          adjustments: ["resized", "compressed"],
          explanation: "Favicon optimized.",
        },
      ],
    });

    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /processar lote/i }));

    await waitFor(() => {
      expect(mockProcessBatch).toHaveBeenCalledWith(
        "batch-1",
        "t1",
        undefined,
        undefined,
      );
    }, { timeout: 10000 });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ type: "SET_STEP", step: 2 });
    }, { timeout: 10000 });
  }, 15000);

  it("polls getBatch until images reach terminal status", async () => {
    const user = userEvent.setup();
    setProcessReadyState();

    mockProcessBatch.mockResolvedValue({});
    // Poll 1: all processing
    mockGetBatch.mockResolvedValueOnce({
      status: "processing",
      images: [
        { id: "u1", status: "processing" },
        { id: "u2", status: "processing" },
      ],
    });
    // Poll 2: one done, one still processing
    mockGetBatch.mockResolvedValueOnce({
      status: "processing",
      images: [
        { id: "u1", status: "processed", processedWidth: 1920, processedHeight: 1080, processedSizeKb: 200, processedFormat: "jpeg", adjustments: [], explanation: null },
        { id: "u2", status: "processing" },
      ],
    });
    // Poll 3: all done
    mockGetBatch.mockResolvedValueOnce({
      status: "processed",
      images: [
        { id: "u1", status: "processed", processedWidth: 1920, processedHeight: 1080, processedSizeKb: 200, processedFormat: "jpeg", adjustments: [], explanation: null },
        { id: "u2", status: "processed", processedWidth: 128, processedHeight: 128, processedSizeKb: 30, processedFormat: "png", adjustments: [], explanation: null },
      ],
    });

    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /processar lote/i }));

    await waitFor(() => {
      expect(mockGetBatch).toHaveBeenCalledTimes(3);
    }, { timeout: 15000 });

    expect(dispatch).toHaveBeenCalledWith({ type: "SET_STEP", step: 2 });

    // First image should have been updated after poll 2
    const img0 = useBatchStore.getState().images[0];
    expect(img0.status).toBe("processed");
    expect(img0.processedResult).toBeTruthy();
  }, 20000);

  it("stores processedResult on each image after processing", async () => {
    const user = userEvent.setup();
    setProcessReadyState();

    mockProcessBatch.mockResolvedValue({});
    mockGetBatch.mockResolvedValue({
      status: "processed",
      images: [
        {
          id: "u1",
          status: "processed",
          processedWidth: 1920,
          processedHeight: 1080,
          processedSizeKb: 200,
          processedFormat: "jpeg",
          adjustments: ["resized"],
          explanation: "Resized.",
        },
        {
          id: "u2",
          status: "processed",
          processedWidth: 128,
          processedHeight: 128,
          processedSizeKb: 30,
          processedFormat: "png",
          adjustments: [],
          explanation: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /processar lote/i }));

    await waitFor(() => {
      const img0 = useBatchStore.getState().images[0];
      expect(img0.processedResult).toBeTruthy();
      expect(img0.processedResult?.width).toBe(1920);
      expect(img0.processedResult?.sizeKb).toBe(200);
    }, { timeout: 10000 });
  }, 15000);

  it("in per-image mode, uses most common selectedTypeId as default_type_id", async () => {
    const user = userEvent.setup();
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      globalQualityTier: "medium",
      assignmentMode: "per-image",
      images: [
        { file: createTestFile("a.png"), uploadId: "u1", status: "analyzed", analysis: fullAnalysis, selectedTypeId: "t1", qualityScore: 8, qualityTier: null, processedResult: null, autoMatchScore: null, cropCoordinates: null, error: null },
        { file: createTestFile("b.png"), uploadId: "u2", status: "analyzed", analysis: fullAnalysis, selectedTypeId: "t1", qualityScore: 7, qualityTier: null, processedResult: null, autoMatchScore: null, cropCoordinates: null, error: null },
        { file: createTestFile("c.png"), uploadId: "u3", status: "analyzed", analysis: fullAnalysis, selectedTypeId: "t2", qualityScore: 6, qualityTier: null, processedResult: null, autoMatchScore: null, cropCoordinates: null, error: null },
      ],
    });

    mockProcessBatch.mockResolvedValue({});
    mockGetBatch.mockResolvedValue({
      status: "processed",
      images: [
        { id: "u1", status: "processed", processedWidth: 1920, processedHeight: 1080, processedSizeKb: 200, processedFormat: "jpeg", adjustments: [], explanation: null },
        { id: "u2", status: "processed", processedWidth: 1920, processedHeight: 1080, processedSizeKb: 200, processedFormat: "jpeg", adjustments: [], explanation: null },
        { id: "u3", status: "processed", processedWidth: 128, processedHeight: 128, processedSizeKb: 30, processedFormat: "png", adjustments: [], explanation: null },
      ],
    });

    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /processar lote/i }));

    await waitFor(() => {
      // t1 appears 2 times, t2 appears 1 time → default_type_id should be t1
      expect(mockProcessBatch).toHaveBeenCalledWith("batch-1", "t1", { u3: "t2" }, undefined);
    }, { timeout: 10000 });
  }, 15000);

  it("matches processedResult by uploadId even when server returns images in different order", async () => {
    const user = userEvent.setup();
    setProcessReadyState();

    mockProcessBatch.mockResolvedValue({});
    // Server returns images in REVERSED order (u2 first, u1 second)
    mockGetBatch.mockResolvedValue({
      status: "processed",
      images: [
        {
          id: "u2",
          status: "processed",
          processedWidth: 128,
          processedHeight: 128,
          processedSizeKb: 30,
          processedFormat: "png",
          adjustments: ["compressed"],
          explanation: "Favicon optimized.",
        },
        {
          id: "u1",
          status: "processed",
          processedWidth: 1920,
          processedHeight: 1080,
          processedSizeKb: 200,
          processedFormat: "jpeg",
          adjustments: ["resized"],
          explanation: "Resized.",
        },
      ],
    });

    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /processar lote/i }));

    await waitFor(() => {
      const images = useBatchStore.getState().images;
      // Image 0 (uploadId=u1) should get u1's result (1920x1080), NOT u2's
      expect(images[0].processedResult?.width).toBe(1920);
      expect(images[0].processedResult?.format).toBe("jpeg");
      // Image 1 (uploadId=u2) should get u2's result (128x128), NOT u1's
      expect(images[1].processedResult?.width).toBe(128);
      expect(images[1].processedResult?.format).toBe("png");
    }, { timeout: 10000 });
  }, 15000);

  it("sends crop coordinates to processBatch when images have crops", async () => {
    const user = userEvent.setup();
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: "t1",
      globalQualityTier: "medium",
      assignmentMode: "global",
      images: [
        { file: createTestFile("a.png"), uploadId: "u1", status: "analyzed", analysis: fullAnalysis, selectedTypeId: null, qualityScore: 8, qualityTier: null, processedResult: null, autoMatchScore: null, cropCoordinates: { x: 10, y: 20, width: 100, height: 80 }, error: null },
        { file: createTestFile("b.png"), uploadId: "u2", status: "analyzed", analysis: fullAnalysis, selectedTypeId: null, qualityScore: 7, qualityTier: null, processedResult: null, autoMatchScore: null, cropCoordinates: null, error: null },
      ],
    });

    mockProcessBatch.mockResolvedValue({});
    mockGetBatch.mockResolvedValue({
      status: "processed",
      images: [
        { id: "u1", status: "processed", processedWidth: 1920, processedHeight: 1080, processedSizeKb: 200, processedFormat: "jpeg", adjustments: [], explanation: null },
        { id: "u2", status: "processed", processedWidth: 1920, processedHeight: 1080, processedSizeKb: 200, processedFormat: "jpeg", adjustments: [], explanation: null },
      ],
    });

    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /processar lote/i }));

    await waitFor(() => {
      expect(mockProcessBatch).toHaveBeenCalledWith(
        "batch-1",
        "t1",
        undefined,
        { u1: { x: 10, y: 20, width: 100, height: 80 } },
      );
    }, { timeout: 10000 });
  }, 15000);

  // ── Auto-select mode ──────

  it("renders three mode buttons in reviewed state", () => {
    setReviewedState();
    renderWithProviders(dispatch);
    expect(screen.getByRole("button", { name: /aplicar para todos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /auto-selecionar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /personalizar/i })).toBeInTheDocument();
  });

  it("clicking Auto-selecionar sets mode to auto-select", async () => {
    const user = userEvent.setup();
    setReviewedState();
    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /auto-selecionar/i }));
    expect(useBatchStore.getState().assignmentMode).toBe("auto-select");
  });

  it("auto-select mode shows per-image dropdowns", async () => {
    setReviewedState({ assignmentMode: "auto-select" });
    renderWithProviders(dispatch);
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(1);
  });

  it("auto-select mode hides TypeSelector grid", () => {
    setReviewedState({ assignmentMode: "auto-select" });
    renderWithProviders(dispatch);
    expect(screen.queryByText("Seleção de Tipo")).not.toBeInTheDocument();
  });

  it("auto-select mode shows helper text about automatic assignment", () => {
    setReviewedState({ assignmentMode: "auto-select" });
    renderWithProviders(dispatch);
    expect(screen.getByText(/tipos atribuídos automaticamente/i)).toBeInTheDocument();
  });

  it("shows match confidence badge when autoMatchScore is set", () => {
    setReviewedState({
      assignmentMode: "auto-select",
      images: [{ ...reviewedImage, selectedTypeId: "t1", autoMatchScore: 0.95 }],
    });
    renderWithProviders(dispatch);
    expect(screen.getByText("95% compatível")).toBeInTheDocument();
  });

  it("auto-select mode shows warning for images without type", () => {
    setReviewedState({ assignmentMode: "auto-select" });
    renderWithProviders(dispatch);
    expect(screen.getByText(/1 imagem sem tipo selecionado/i)).toBeInTheDocument();
  });

  it("auto-select mode enables crop button when type is assigned", () => {
    setReviewedState({
      assignmentMode: "auto-select",
      images: [{ ...reviewedImage, selectedTypeId: "t1", autoMatchScore: 0.95 }],
    });
    renderWithProviders(dispatch);
    expect(screen.getByRole("button", { name: /recortar a\.png/i })).not.toBeDisabled();
  });

  it("auto-select mode sends per-image overrides in handleProcess", async () => {
    const user = userEvent.setup();
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      globalQualityTier: "medium",
      assignmentMode: "auto-select",
      images: [
        { file: createTestFile("a.png"), uploadId: "u1", status: "analyzed", analysis: fullAnalysis, selectedTypeId: "t1", qualityScore: 8, qualityTier: null, processedResult: null, autoMatchScore: 0.95, cropCoordinates: null, error: null },
        { file: createTestFile("b.png"), uploadId: "u2", status: "analyzed", analysis: fullAnalysis, selectedTypeId: "t2", qualityScore: 7, qualityTier: null, processedResult: null, autoMatchScore: 0.80, cropCoordinates: null, error: null },
      ],
    });

    mockProcessBatch.mockResolvedValue({});
    mockGetBatch.mockResolvedValue({
      status: "processed",
      images: [
        { id: "u1", status: "processed", processedWidth: 1920, processedHeight: 1080, processedSizeKb: 200, processedFormat: "jpeg", adjustments: [], explanation: null },
        { id: "u2", status: "processed", processedWidth: 800, processedHeight: 600, processedSizeKb: 100, processedFormat: "jpeg", adjustments: [], explanation: null },
      ],
    });

    renderWithProviders(dispatch);
    await user.click(screen.getByRole("button", { name: /processar lote/i }));

    await waitFor(() => {
      // t1 is most common → default, t2 is override for u2
      expect(mockProcessBatch).toHaveBeenCalledWith("batch-1", "t1", { u2: "t2" }, undefined);
    }, { timeout: 10000 });
  }, 15000);

  // ── Hide Revisão por Imagem in global mode until type selected ──────

  it("hides Revisão por Imagem in global mode when no type selected", () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      assignmentMode: "global",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          originalWidth: 800,
          originalHeight: 600,
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          autoMatchScore: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    expect(screen.queryByText("Revisão por Imagem")).not.toBeInTheDocument();
  });

  it("shows Revisão por Imagem in global mode after type is selected", () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: "t1",
      assignmentMode: "global",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          originalWidth: 800,
          originalHeight: 600,
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          autoMatchScore: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    expect(screen.getByText("Revisão por Imagem")).toBeInTheDocument();
  });

  it("always shows Revisão por Imagem in per-image mode even without global type", () => {
    useBatchStore.setState({
      batchStep: "reviewed",
      batchId: "batch-1",
      globalTypeId: null,
      assignmentMode: "per-image",
      images: [
        {
          file: createTestFile("a.png"),
          uploadId: "u1",
          originalWidth: 800,
          originalHeight: 600,
          status: "analyzed",
          analysis: {
            quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
            content: { type: "photo", primary_subject: "Landscape", has_text: false, has_transparency: false, dominant_colors: [] },
            suggested_type: { image_type_id: "t1", type_key: "fundo_login", display_name: "Fundo Login", confidence: 90, reasoning: "Photo" },
            crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
          },
          selectedTypeId: null,
          qualityScore: 8,
          qualityTier: null,
          processedResult: null,
          autoMatchScore: null,
          cropCoordinates: null,
          error: null,
        },
      ],
    });

    renderWithProviders(dispatch);
    expect(screen.getByText("Revisão por Imagem")).toBeInTheDocument();
  });
});
