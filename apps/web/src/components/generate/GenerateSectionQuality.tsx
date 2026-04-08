import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGenerationStore } from "@/stores/generation-store";
import {
  fetchImageTypes,
  generateImage,
  generateImageCustom,
  generateImageFromPreset,
  getGenerationCostEstimate,
  getCustomResolutionCostEstimate,
  ModerationRejectedError,
} from "@/lib/api";
import { QualitySelector } from "@/components/QualitySelector";
import type { QualityTier } from "@/stores/generation-store";

const MODEL_LABELS: Record<string, { name: string; description: string }> = {
  recraft_v3: { name: "Recraft V3", description: "Design assets, logos, ícones" },
  flux2_pro: { name: "FLUX.2 Pro", description: "Fundos, capas, conteúdo fotorrealista" },
};

const FLUX_PRESETS = new Set([
  "fundo_login", "fundo_login_mobile", "testeira_email",
  "conteudo_imagem", "capa_workspace", "fundo_workspace", "banner_campanha",
]);

type ImageType = {
  id: string;
  category: string;
  typeKey: string;
  displayName: string;
  width: number | null;
  height: number | null;
  maxFileSizeKb: number;
  allowedFormats: string[];
  services: string[] | null;
};

export function GenerateSectionQuality() {
  const step = useGenerationStore((s) => s.step);
  const selectedTypeId = useGenerationStore((s) => s.selectedTypeId);
  const prompt = useGenerationStore((s) => s.prompt);
  const qualityTier = useGenerationStore((s) => s.qualityTier);
  const error = useGenerationStore((s) => s.error);
  const moderation = useGenerationStore((s) => s.moderation);
  const generationMode = useGenerationStore((s) => s.generationMode);
  const customWidth = useGenerationStore((s) => s.customWidth);
  const customHeight = useGenerationStore((s) => s.customHeight);
  const customStyle = useGenerationStore((s) => s.customStyle);
  const customPresetId = useGenerationStore((s) => s.customPresetId);
  const setQualityTier = useGenerationStore((s) => s.setQualityTier);
  const setStep = useGenerationStore((s) => s.setStep);
  const setResult = useGenerationStore((s) => s.setResult);
  const setError = useGenerationStore((s) => s.setError);
  const setModeration = useGenerationStore((s) => s.setModeration);
  const applySuggestedPrompt = useGenerationStore((s) => s.applySuggestedPrompt);

  const moderationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === "moderated" && moderationRef.current) {
      moderationRef.current.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  }, [step]);

  // Fetch image types to find the selected type
  const { data: typesData } = useQuery<{ grouped: Record<string, ImageType[]> }>({
    queryKey: ["image-types"],
    queryFn: fetchImageTypes,
  });

  const selectedType = typesData
    ? Object.values(typesData.grouped).flat().find((t) => t.id === selectedTypeId)
    : null;

  const resolvedModel = selectedType
    ? FLUX_PRESETS.has(selectedType.typeKey) ? "flux2_pro" : "recraft_v3"
    : null;

  // Cost estimate -- presets
  const { data: costData } = useQuery({
    queryKey: ["generation-cost-estimate", selectedType?.typeKey],
    queryFn: () => getGenerationCostEstimate(selectedType!.typeKey),
    enabled: !!selectedType,
    staleTime: 5 * 60 * 1000,
  });

  // Cost estimate -- custom resolutions
  const { data: customCostData } = useQuery({
    queryKey: ["generation-cost-custom", customWidth, customHeight, customStyle],
    queryFn: () => getCustomResolutionCostEstimate(customWidth!, customHeight!, customStyle),
    enabled: generationMode !== "preset" && !!customWidth && !!customHeight,
    staleTime: 30_000,
  });

  const hasValidSource = selectedTypeId || (customWidth && customHeight) || customPresetId;
  const canGenerate = hasValidSource && prompt.trim().length >= 10 && step !== "generating" && step !== "processing";

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setStep("generating");
    try {
      let res;
      if (generationMode === "preset" && selectedTypeId) {
        res = await generateImage(selectedTypeId, prompt.trim(), qualityTier);
      } else if (generationMode === "custom" && customWidth && customHeight) {
        res = await generateImageCustom(customWidth, customHeight, prompt.trim(), qualityTier, customStyle);
      } else if (generationMode === "custom-preset" && customPresetId) {
        res = await generateImageFromPreset(customPresetId, prompt.trim(), qualityTier);
      } else {
        setError("Selecione um tipo de imagem ou defina dimensões personalizadas");
        return;
      }
      setResult(res);
    } catch (err) {
      if (err instanceof ModerationRejectedError) {
        setModeration({
          analysis: err.moderation.analysis,
          suggestedPrompt: err.moderation.suggested_prompt,
          flaggedReasons: err.moderation.flagged_reasons,
        });
      } else {
        setError(err instanceof Error ? err.message : "Erro na geração");
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Model indicator -- for presets */}
      {resolvedModel && (
        <div className="flex items-center gap-3">
          <span className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            resolvedModel === "flux2_pro"
              ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
              : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
          }`}>
            {MODEL_LABELS[resolvedModel]?.name}
          </span>
          <span className="text-xs text-on-surface-variant">
            {MODEL_LABELS[resolvedModel]?.description}
          </span>
        </div>
      )}

      {/* Model indicator -- for custom modes */}
      {!resolvedModel && customCostData?.model && (
        <div className="flex items-center gap-3">
          <span className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            customCostData.model === "flux2_pro"
              ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
              : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
          }`}>
            {MODEL_LABELS[customCostData.model]?.name || customCostData.model}
          </span>
          <span className="text-xs text-on-surface-variant">
            {MODEL_LABELS[customCostData.model]?.description || ""}
          </span>
        </div>
      )}

      {/* Quality selector */}
      <QualitySelector
        selectedTier={qualityTier}
        onSelect={(tier) => setQualityTier(tier as QualityTier)}
        costs={costData?.costsByTier ?? customCostData?.costsByTier}
        modelLabel={resolvedModel ? MODEL_LABELS[resolvedModel]?.name : customCostData?.model ? MODEL_LABELS[customCostData.model]?.name : undefined}
        note={costData?.note ?? customCostData?.note}
      />

      {/* PRICING_HIDDEN: commented out for demo
      {(costData?.costsByTier || customCostData?.costsByTier) && (
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <svg className="h-4 w-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Custo estimado: <span className="font-mono font-semibold text-primary">
              ${((costData?.costsByTier ?? customCostData?.costsByTier)?.[qualityTier] ?? 0).toFixed(3)}
            </span>
            {costData?.needsTransparency && (
              <span className="text-outline ml-1">(inclui remoção de fundo)</span>
            )}
          </span>
        </div>
      )}
      */}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-3.5 text-lg font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
      >
        {step === "generating" || step === "processing" ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
            </svg>
            {step === "generating" ? "Gerando imagem..." : "Processando..."}
          </span>
        ) : (
          "Gerar Imagem"
        )}
      </button>

      {/* Moderation */}
      {step === "moderated" && moderation && (
        <div
          ref={moderationRef}
          role="alert"
          className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 space-y-4 scroll-mt-20 animate-fade-slide-in"
        >
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div className="space-y-1">
              <h4 className="font-headline font-bold text-amber-300">Prompt rejeitado pela política de conteúdo</h4>
              <div className="flex flex-wrap gap-1.5">
                {moderation.flaggedReasons.map((reason) => (
                  <span key={reason} className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="text-sm text-amber-200/80 leading-relaxed">{moderation.analysis}</p>

          {moderation.suggestedPrompt && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-amber-300/70 uppercase tracking-wide">Prompt sugerido</p>
              <div className="rounded-lg bg-surface-container-low border border-amber-500/10 p-3">
                <p className="text-sm text-on-surface italic">&ldquo;{moderation.suggestedPrompt}&rdquo;</p>
              </div>
              <button
                onClick={applySuggestedPrompt}
                className="w-full rounded-lg bg-amber-500/15 border border-amber-500/20 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors"
              >
                Usar prompt sugerido
              </button>
            </div>
          )}

          <button
            onClick={() => setStep("idle")}
            className="text-xs text-amber-300/60 underline hover:text-amber-300/80"
          >
            Editar prompt manualmente
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setStep("idle")} className="mt-2 text-xs text-red-300 underline">
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
