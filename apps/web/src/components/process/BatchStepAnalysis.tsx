import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBatchStore } from "@/stores/batch-store";
import { BatchProgressGrid } from "@/components/batch/BatchProgressGrid";
import { CropModal } from "@/components/CropModal";
import { TypeSelector } from "./TypeSelector";
import { createBatch, uploadToBatch, analyzeBatch, getBatch, fetchImageTypes, processBatch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProcessWizardAction, ProcessStep } from "./process-wizard-reducer";

type ImageType = {
  id: string;
  displayName: string;
  typeKey: string;
  category?: string;
  width?: number;
  height?: number;
};

type Props = {
  dispatch: React.Dispatch<ProcessWizardAction>;
};

const CATEGORY_LABELS: Record<string, string> = {
  admin: "Admin / Branding",
  content: "Conteúdo",
  user: "Usuário",
  gamification: "Gamificação",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  photo: "Foto",
  illustration: "Ilustração",
  screenshot: "Captura de tela",
  icon: "Ícone",
  logo: "Logo",
  diagram: "Diagrama",
  text: "Texto",
};

function ThumbnailCell({ file, className }: { file: File; className: string }) {
  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState('');
  useEffect(() => {
    const blobUrl = URL.createObjectURL(file);
    setSrc(blobUrl);
    return () => URL.revokeObjectURL(blobUrl);
  }, [file]);
  return (
    <div className="relative">
      {!loaded && (
        <div className="absolute inset-0 animate-pulse rounded bg-surface-container-high" aria-hidden="true">
          <div className="flex h-full items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </div>
      )}
      {src && (
        <img
          src={src}
          alt={file.name}
          className={className}
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}

export function BatchStepAnalysis({ dispatch }: Props) {
  const { images, batchStep, batchId, globalTypeId, assignmentMode, updateImage, setBatchStep, setBatchId, setGlobalTypeId, setAssignmentMode, setCropForImage, prefillPerImageTypes, prefillByResolution } = useBatchStore();
  const isPerImageLike = assignmentMode === "per-image" || assignmentMode === "auto-select";
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropModalIndex, setCropModalIndex] = useState<number | null>(null);
  const hasStartedRef = useRef(false);

  const { data: typesData } = useQuery<{ types: ImageType[]; grouped: Record<string, ImageType[]> }>({
    queryKey: ["image-types"],
    queryFn: fetchImageTypes,
  });

  const totalSize = images.reduce((sum, img) => sum + img.file.size, 0);
  const totalSizeLabel = totalSize < 1024 * 1024
    ? `${Math.round(totalSize / 1024)} KB`
    : `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;

  useEffect(() => {
    if (batchStep === "selecting" && images.length > 0 && !hasStartedRef.current) {
      hasStartedRef.current = true;
      handleStartAnalysis();
    }
  }, [batchStep, images.length]);

  // Compute most common suggested type from batch analysis
  const suggestedTypeId = (() => {
    const counts: Record<string, number> = {};
    images.forEach((img) => {
      const id = img.analysis?.suggested_type?.image_type_id;
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? null;
  })();

  async function handleStartAnalysis() {
    setIsRunning(true);
    setError(null);

    try {
      // 1. Create batch
      const batch = await createBatch();
      setBatchId(batch.id);
      setBatchStep("uploading");

      // 2. Upload all files
      for (let i = 0; i < images.length; i++) {
        updateImage(i, { status: "uploading" });
        const result = await uploadToBatch(batch.id, images[i].file);
        updateImage(i, { uploadId: result.id, originalWidth: result.width ?? 0, originalHeight: result.height ?? 0, status: "uploaded" });
      }

      // 3. Analyze batch
      setBatchStep("analyzing");
      for (let i = 0; i < images.length; i++) {
        updateImage(i, { status: "analyzing" });
      }
      await analyzeBatch(batch.id);

      // 4. Poll until all analyzed — match by uploadId, not array index
      const batchResult = await getBatch(batch.id);
      const currentImages = useBatchStore.getState().images;
      for (let i = 0; i < currentImages.length; i++) {
        const serverImg = batchResult.images?.find(
          (img: { id: string }) => img.id === currentImages[i].uploadId
        );
        if (serverImg) {
          updateImage(i, {
            status: "analyzed",
            analysis: serverImg.analysis,
            qualityScore: serverImg.analysis?.quality?.score ?? null,
          });
        }
      }

      // 5. Brief delay so user sees 100% progress before transition
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 6. Advance to reviewed (shows TypeSelector)
      setBatchStep("reviewed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na análise do lote");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleProcess() {
    const currentBatchId = useBatchStore.getState().batchId;
    const currentImages = useBatchStore.getState().images;
    const currentGlobalTypeId = useBatchStore.getState().globalTypeId;
    const currentAssignmentMode = useBatchStore.getState().assignmentMode;

    if (!currentBatchId || (currentAssignmentMode === "global" && !currentGlobalTypeId)) return;
    setIsRunning(true);
    setError(null);

    try {
      let effectiveDefaultTypeId: string;
      const overrides: Record<string, string> = {};

      if (currentAssignmentMode === "per-image" || currentAssignmentMode === "auto-select") {
        // Compute most common selectedTypeId as default_type_id
        const typeCounts: Record<string, number> = {};
        for (const img of currentImages) {
          if (img.selectedTypeId) {
            typeCounts[img.selectedTypeId] = (typeCounts[img.selectedTypeId] || 0) + 1;
          }
        }
        const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
        effectiveDefaultTypeId = sorted[0]?.[0] ?? currentGlobalTypeId!;

        // Overrides for images differing from computed default
        for (const img of currentImages) {
          if (img.selectedTypeId && img.uploadId && img.selectedTypeId !== effectiveDefaultTypeId) {
            overrides[img.uploadId] = img.selectedTypeId;
          }
        }
      } else {
        effectiveDefaultTypeId = currentGlobalTypeId!;
        // No per-image overrides in global mode — global type applies to all
      }

      // Build crop coordinates map
      const crops: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const img of currentImages) {
        if (img.cropCoordinates && img.uploadId) {
          crops[img.uploadId] = img.cropCoordinates;
        }
      }

      setBatchStep("processing");
      for (let i = 0; i < currentImages.length; i++) {
        updateImage(i, { status: "processing" });
      }

      await processBatch(
        currentBatchId,
        effectiveDefaultTypeId,
        Object.keys(overrides).length > 0 ? overrides : undefined,
        Object.keys(crops).length > 0 ? crops : undefined,
      );

      // Poll until batch processing completes (backend returns 202 and processes async)
      const MAX_POLLS = 30;
      const POLL_INTERVAL = 2000;

      for (let poll = 0; poll < MAX_POLLS; poll++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        const batchResult = await getBatch(currentBatchId);

        // Update per-image statuses live — match by uploadId, not array index
        for (let i = 0; i < currentImages.length; i++) {
          const serverImg = batchResult.images?.find(
            (img: { id: string }) => img.id === currentImages[i].uploadId
          );
          if (serverImg) {
            const isTerminal = serverImg.status === "processed" || serverImg.status === "error";
            if (isTerminal) {
              updateImage(i, {
                status: serverImg.status,
                processedResult: serverImg.status === "processed"
                  ? {
                      width: serverImg.processedWidth,
                      height: serverImg.processedHeight,
                      sizeKb: serverImg.processedSizeKb,
                      format: serverImg.processedFormat,
                      adjustments: serverImg.adjustments ?? [],
                      explanation: serverImg.explanation ?? null,
                      downloadUrl: `/api/v1/images/${serverImg.id}/download`,
                    }
                  : null,
              });
            }
          }
        }

        // Check if all done
        const allTerminal = batchResult.images?.every(
          (img: { status: string }) => img.status === "processed" || img.status === "error"
        );
        if (allTerminal || batchResult.status === "processed") break;
      }

      // Mark any remaining non-terminal images as errors (timeout safety)
      const finalImages = useBatchStore.getState().images;
      for (let i = 0; i < finalImages.length; i++) {
        if (finalImages[i].status !== "processed" && finalImages[i].status !== "error") {
          updateImage(i, { status: "error", processedResult: null });
        }
      }

      setBatchStep("completed");
      dispatch({ type: "SET_STEP", step: 2 as ProcessStep });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar lote");
    } finally {
      setIsRunning(false);
    }
  }

  if (images.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-xl py-12">
        <p className="text-sm text-on-surface-variant">Nenhuma imagem selecionada</p>
      </div>
    );
  }

  const missingCount = images.filter(img => !img.selectedTypeId).length;
  const isReviewed = batchStep === "reviewed";
  const showFileGrid = batchStep !== "reviewed" && batchStep !== "processing" && batchStep !== "completed";

  return (
    <div className="space-y-4">
      {/* File preview grid — hidden once past analysis (reviewed/processing/completed) */}
      {showFileGrid && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-on-surface font-headline">
              {images.length} imagens selecionadas
            </h3>
            <span className="text-sm text-on-surface-variant">{totalSizeLabel}</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative group rounded-lg border border-outline-variant/10 bg-surface-container-high p-1.5">
                <ThumbnailCell file={img.file} className="h-16 w-full object-cover rounded" />
                <p className="text-[9px] text-on-surface-variant mt-1 truncate">{img.file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress grid (visible during upload/analyze/process) */}
      <BatchProgressGrid />

      {/* Error */}
      {error && (
        <div className="glass-card rounded-xl p-4 border border-error/30">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Error retry */}
      {error && !isRunning && (
        <button
          onClick={() => { hasStartedRef.current = false; handleStartAnalysis(); }}
          className="w-full rounded-xl bg-gradient-to-r from-primary-dim to-primary py-3 text-sm font-semibold text-white shadow-lg hover:shadow-primary/25 transition-all"
        >
          Tentar novamente
        </button>
      )}

      {/* Post-analysis: Segmented control + TypeSelector/per-image review */}
      {isReviewed && (
        <>
          {/* Assignment mode segmented control */}
          <div className="glass-card rounded-xl p-6 space-y-3">
            <div className="flex gap-1 rounded-xl bg-surface-container-low p-1">
              <button
                onClick={() => setAssignmentMode("global")}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  assignmentMode === "global"
                    ? "bg-surface-container-high text-primary shadow-lg"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
                }`}
              >
                Aplicar para todos
              </button>
              <button
                onClick={() => { setAssignmentMode("auto-select"); if (typesData?.types) prefillByResolution(typesData.types); }}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  assignmentMode === "auto-select"
                    ? "bg-surface-container-high text-primary shadow-lg"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
                }`}
              >
                Auto-selecionar
              </button>
              <button
                onClick={() => { setAssignmentMode("per-image"); prefillPerImageTypes(); }}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  assignmentMode === "per-image"
                    ? "bg-surface-container-high text-primary shadow-lg"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
                }`}
              >
                Personalizar
              </button>
            </div>
            <p className="text-xs text-on-surface-variant">
              {assignmentMode === "global"
                ? `Selecione o tipo para todas as ${images.length} imagens`
                : assignmentMode === "auto-select"
                  ? "Tipos atribuídos automaticamente por resolução — ajuste se necessário"
                  : "Defina o tipo de cada imagem individualmente"}
            </p>
          </div>

          {/* Global type picker — only in global mode */}
          {assignmentMode === "global" && (
            <TypeSelector
              selectedTypeId={globalTypeId}
              onSelectType={(typeId) => setGlobalTypeId(typeId)}
              suggestedTypeId={suggestedTypeId}
            />
          )}

          {/* Per-image review list — hidden in global mode until a type is chosen */}
          {(assignmentMode !== "global" || globalTypeId !== null) && (
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-on-surface font-headline">
              Revisão por Imagem
            </h3>
            {isPerImageLike && missingCount > 0 && (
              <div role="status" className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5">
                <svg className="h-4 w-4 text-warning shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="text-sm font-medium text-warning">
                  {missingCount} {missingCount === 1 ? "imagem" : "imagens"} sem tipo selecionado
                </span>
              </div>
            )}
            <div className="space-y-2">
              {images.map((img, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-lg p-3 border",
                    isPerImageLike && !img.selectedTypeId
                      ? "border-warning/40 bg-warning/5"
                      : "border-outline-variant/10 bg-surface-container-low"
                  )}
                >
                  <ThumbnailCell file={img.file} className="h-10 w-10 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface truncate">{img.file.name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {/* Quality score badge */}
                      {img.qualityScore !== null && (
                        <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${
                          img.qualityScore >= 7
                            ? "bg-success/10 text-success"
                            : img.qualityScore >= 5
                              ? "bg-warning/10 text-warning"
                              : "bg-error/10 text-error"
                        }`}>
                          {img.qualityScore}/10
                        </span>
                      )}
                      {/* Content type label */}
                      {img.analysis?.content?.type && (
                        <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                          {CONTENT_TYPE_LABELS[img.analysis.content.type] ?? img.analysis.content.type}
                        </span>
                      )}
                      {/* Quality issue chips */}
                      {img.analysis?.quality?.issues?.map((issue, j) => (
                        <span key={j} className="rounded-md bg-warning/10 px-2 py-0.5 text-xs text-warning">
                          {issue}
                        </span>
                      ))}
                      {/* Suggested type */}
                      {img.analysis?.suggested_type?.display_name && (
                        <span className="text-xs text-on-surface-variant">
                          Sugestão IA: {img.analysis.suggested_type.display_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Match confidence badge — auto-select mode only */}
                  {assignmentMode === "auto-select" && img.autoMatchScore != null && (
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      img.autoMatchScore >= 0.8
                        ? "bg-success/10 text-success"
                        : img.autoMatchScore >= 0.5
                          ? "bg-warning/10 text-warning"
                          : "bg-error/10 text-error"
                    )}>
                      {Math.round(img.autoMatchScore * 100)}% compatível
                    </span>
                  )}
                  {/* Per-image type override dropdown — per-image & auto-select modes */}
                  {isPerImageLike && (
                    <select
                      value={img.selectedTypeId || ""}
                      onChange={(e) => updateImage(i, { selectedTypeId: e.target.value || null })}
                      className={cn(
                        "rounded bg-surface-container-low border px-2 py-1 text-xs text-on-surface",
                        !img.selectedTypeId
                          ? "border-warning text-warning"
                          : "border-outline-variant/20"
                      )}
                    >
                      <option value="">
                        {globalTypeId
                          ? `Global (${typesData?.types?.find((t) => t.id === globalTypeId)?.displayName ?? ""})`
                          : "Tipo Global"}
                      </option>
                      {typesData?.grouped
                        ? Object.entries(typesData.grouped).map(([cat, types]) => (
                            <optgroup key={cat} label={CATEGORY_LABELS[cat] || cat}>
                              {types.map((t) => (
                                <option key={t.id} value={t.id}>{t.displayName}</option>
                              ))}
                            </optgroup>
                          ))
                        : typesData?.types?.map((t) => (
                            <option key={t.id} value={t.id}>{t.displayName}</option>
                          ))
                      }
                    </select>
                  )}
                  {img.cropCoordinates && (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      Recortado
                    </span>
                  )}
                  <button
                    onClick={() => setCropModalIndex(i)}
                    disabled={!(isPerImageLike ? img.selectedTypeId : globalTypeId)}
                    aria-label={`Recortar ${img.file.name}`}
                    className="rounded bg-surface-container-low border border-outline-variant/20 px-2 py-1 text-xs text-on-surface-variant hover:text-on-surface disabled:opacity-40"
                  >
                    ✂ Recortar
                  </button>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Process button — sticky */}
          <div className="sticky bottom-0 z-10 bg-gradient-to-t from-background via-background to-transparent pt-4 pb-2">
            <button
              onClick={handleProcess}
              disabled={(!isPerImageLike ? !globalTypeId : !images.every(img => img.selectedTypeId !== null)) || isRunning}
              className="w-full rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-3 text-sm font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? "Processando..." : "Processar Lote"}
            </button>
          </div>
        </>
      )}

      {/* CropModal for batch per-image crop */}
      {cropModalIndex !== null && (() => {
        const cropImg = images[cropModalIndex];
        const effectiveTypeId = isPerImageLike ? cropImg?.selectedTypeId : globalTypeId;
        const targetType = typesData?.types?.find((t: ImageType) => t.id === effectiveTypeId);
        return (
          <CropModal
            imageSrc={URL.createObjectURL(cropImg.file)}
            isOpen={true}
            onClose={() => setCropModalIndex(null)}
            onConfirm={(crop) => {
              setCropForImage(cropModalIndex, crop);
              setCropModalIndex(null);
            }}
            onSkip={() => setCropModalIndex(null)}
            targetWidth={targetType?.width ?? null}
            targetHeight={targetType?.height ?? null}
            typeName={targetType?.displayName ?? ""}
          />
        );
      })()}
    </div>
  );
}
