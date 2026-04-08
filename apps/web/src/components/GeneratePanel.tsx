import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useGenerationStore, type QualityTier, type CustomStyle } from "@/stores/generation-store";
import { fetchImageTypes, generateImage, generateImageCustom, generateImageFromPreset, getGenerationCostEstimate, getCustomResolutionCostEstimate, ModerationRejectedError } from "@/lib/api";
import { useAuthImage } from "@/hooks/useAuthImage";
import { downloadAuthFile, downloadBlobUrl } from "@/lib/auth-download";
import { useDownload } from "@/hooks/useDownload";
import { QualitySelector } from "./QualitySelector";
import { FormatSelector } from "./FormatSelector";
import { CustomResolutionInput } from "./CustomResolutionInput";
import { StyleSelector } from "./StyleSelector";
import { CustomPresetManager } from "./CustomPresetManager";

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  admin: {
    label: "Admin / Branding",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  content: {
    label: "Conteúdo",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  gamification: {
    label: "Gamificação",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.01 6.01 0 01-2.77.992m5.007-4.495a6.01 6.01 0 01-2.237 3.503M9.497 14.25a6.01 6.01 0 002.77.992m-5.007-4.495a6.01 6.01 0 002.237 3.503" />
      </svg>
    ),
  },
  user: {
    label: "Usuário",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
};

const MODEL_LABELS: Record<string, { name: string; description: string }> = {
  recraft_v3: { name: "Recraft V3", description: "Design assets, logos, ícones" },
  flux2_pro: { name: "FLUX.2 Pro", description: "Fundos, capas, conteúdo fotorrealista" },
};

// Map typeKey to model for display
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

export function GeneratePanel() {
  const {
    step, selectedTypeId, prompt, qualityTier, result, error, moderation,
    generationMode, customWidth, customHeight, customStyle, customPresetId,
    setPrompt, setSelectedTypeId, setQualityTier, setStep, setResult, setError, setModeration,
    setCustomDimensions, setCustomStyle, setCustomPresetId,
    applySuggestedPrompt, reset,
  } = useGenerationStore();

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [downloadFormat, setDownloadFormat] = useState("jpeg");
  const { downloading, trigger: triggerDownload } = useDownload();
  const moderationRef = useRef<HTMLDivElement>(null);

  const previewUrl = result
    ? `${import.meta.env.VITE_API_URL || "/api/v1"}/generate/${result.id}/preview`
    : null;
  const { src: previewSrc, loading: previewLoading } = useAuthImage(previewUrl);

  useEffect(() => {
    if (step === "moderated" && moderationRef.current) {
      moderationRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [step]);

  useEffect(() => {
    if (result?.image?.format) {
      const fmt = result.image.format.toLowerCase();
      setDownloadFormat(fmt === "jpg" ? "jpeg" : fmt);
    }
  }, [result]);

  const { data: typesData } = useQuery<{ grouped: Record<string, ImageType[]> }>({
    queryKey: ["image-types"],
    queryFn: fetchImageTypes,
  });

  const categories = typesData ? Object.keys(typesData.grouped) : [];
  if (!activeTab && categories.length > 0) {
    setActiveTab(categories[0] ?? null);
  }

  // Find selected type
  const selectedType = typesData
    ? Object.values(typesData.grouped).flat().find((t) => t.id === selectedTypeId)
    : null;

  const resolvedModel = selectedType
    ? FLUX_PRESETS.has(selectedType.typeKey) ? "flux2_pro" : "recraft_v3"
    : null;

  // PRICING_HIDDEN: commented out for demo
  // const { data: costData } = useQuery({
  //   queryKey: ["generation-cost-estimate", selectedType?.typeKey],
  //   queryFn: () => getGenerationCostEstimate(selectedType!.typeKey),
  //   enabled: !!selectedType,
  //   staleTime: 5 * 60 * 1000,
  // });

  // PRICING_HIDDEN: commented out for demo
  // const { data: customCostData } = useQuery({
  //   queryKey: ["generation-cost-custom", customWidth, customHeight, customStyle],
  //   queryFn: () => getCustomResolutionCostEstimate(customWidth!, customHeight!, customStyle),
  //   enabled: generationMode !== "preset" && !!customWidth && !!customHeight,
  //   staleTime: 30_000,
  // });

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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center py-2">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-primary font-headline">
          Geração de Imagens por IA
        </h1>
        <p className="mt-2 text-on-surface-variant text-base max-w-xl mx-auto">
          Crie imagens otimizadas para cada preset da plataforma Woli usando modelos de IA de última geração.
        </p>
      </div>

      {/* Prompt Input */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-on-surface font-headline">Descreva a imagem</h3>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Descreva a imagem que deseja gerar... (mínimo 10 caracteres)"
          rows={3}
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-4 py-3 text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
        {prompt.length > 0 && prompt.length < 10 && (
          <p className="text-xs text-outline">{10 - prompt.length} caracteres restantes para o mínimo</p>
        )}
      </div>

      {/* Type Selection */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-on-surface font-headline">Tipo da Imagem</h3>

        {/* Tabs */}
        {categories.length > 0 && (
          <div role="tablist" className="flex gap-1 rounded-xl bg-surface-container-low p-1 w-fit flex-wrap">
            {categories.map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              return (
                <button
                  role="tab"
                  aria-selected={activeTab === cat}
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === cat
                      ? "bg-surface-container-high text-primary shadow-lg"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
                  }`}
                >
                  {config?.icon}
                  {config?.label || cat}
                </button>
              );
            })}
            <button
              role="tab"
              aria-selected={activeTab === "custom"}
              key="custom"
              onClick={() => setActiveTab("custom")}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === "custom"
                  ? "bg-surface-container-high text-primary shadow-lg"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Personalizado
            </button>
          </div>
        )}

        {/* Custom resolution panel */}
        {activeTab === "custom" && (
          <div role="tabpanel" className="space-y-4">
            <CustomResolutionInput
              width={customWidth}
              height={customHeight}
              onChange={(w, h) => setCustomDimensions(w, h)}
            />
            <StyleSelector
              selected={customStyle}
              onSelect={(s) => setCustomStyle(s as CustomStyle)}
            />
            <CustomPresetManager
              width={customWidth}
              height={customHeight}
              selectedPresetId={customPresetId}
              onSelectPreset={(preset) => {
                setCustomPresetId(preset.id);
                setCustomDimensions(preset.width, preset.height);
                setCustomStyle(preset.style as CustomStyle);
              }}
            />
          </div>
        )}

        {/* Type Cards — only for system preset tabs */}
        {activeTab && activeTab !== "custom" && typesData?.grouped[activeTab] && (
          <div role="tabpanel" className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {typesData.grouped[activeTab].map((type) => {
              const isSelected = selectedTypeId === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedTypeId(type.id)}
                  className={`relative rounded-xl border p-4 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-2 border-primary shadow-xl shadow-primary/5"
                      : "bg-surface-container-low hover:bg-surface-container-high border-outline-variant/20"
                  }`}
                >
                  <div className="font-headline font-bold text-on-surface">{type.displayName}</div>
                  <div className="mt-1 text-xs text-on-surface-variant">
                    {type.width && type.height ? `${type.width}x${type.height}px` : "Variável"}
                  </div>
                  {isSelected && (
                    <div className="absolute right-3 top-3">
                      <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Model + Quality + Cost — for both preset and custom modes */}
      {(selectedType || (customWidth && customHeight)) && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          {/* Model indicator — for presets */}
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

          {/* PRICING_HIDDEN: model indicator for custom modes commented out (depends on cost query)
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
          */}

          {/* Quality selector — for presets use typeKey, for custom pass null */}
          <QualitySelector
            selectedTier={qualityTier}
            onSelect={(tier) => setQualityTier(tier as QualityTier)}
            typeKey={selectedType?.typeKey ?? null}
          />

          {/* PRICING_HIDDEN: commented out for demo
          {costData && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <svg className="h-4 w-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Custo estimado: <span className="font-mono font-semibold text-primary">${costData.estimatedCostUsd.toFixed(3)}</span>
                {costData.needsTransparency && (
                  <span className="text-outline ml-1">(inclui remoção de fundo)</span>
                )}
              </span>
            </div>
          )}
          */}

          {/* PRICING_HIDDEN: commented out for demo
          {!costData && customCostData && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <svg className="h-4 w-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Custo estimado: <span className="font-mono font-semibold text-primary">${customCostData.estimatedCostUsd.toFixed(3)}</span>
              </span>
            </div>
          )}
          */}
        </div>
      )}

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

      {/* Result */}
      {result && step === "completed" && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-on-surface font-headline">Imagem Gerada</h3>
            {/* PRICING_HIDDEN: commented out for demo
            <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-mono text-primary">
              ${result.cost_usd.toFixed(3)}
            </span>
            */}
          </div>

          {/* Preview */}
          <div className="flex justify-center rounded-lg bg-surface-container-low p-4">
            {previewLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : previewSrc ? (
              <img
                src={previewSrc}
                alt="Generated"
                className="max-h-96 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-48 items-center justify-center text-on-surface-variant">
                <p className="text-sm">Erro ao carregar preview</p>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-2 text-xs text-on-surface-variant">
            <span className="rounded-md bg-surface-container-high px-2 py-1">
              {result.image.width}x{result.image.height}px
            </span>
            <span className="rounded-md bg-surface-container-high px-2 py-1">
              {result.image.format.toUpperCase()}
            </span>
            <span className="rounded-md bg-surface-container-high px-2 py-1">
              {result.image.size_kb} KB
            </span>
            <span className={`rounded-md px-2 py-1 ${
              result.model === "flux2_pro"
                ? "bg-blue-500/15 text-blue-400"
                : "bg-emerald-500/15 text-emerald-400"
            }`}>
              {MODEL_LABELS[result.model]?.name || result.model}
            </span>
          </div>

          {/* Format + Download */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">Formato de download</span>
              <FormatSelector selected={downloadFormat} onChange={setDownloadFormat} />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={downloading}
                onClick={() => triggerDownload(async () => {
                  const ext = downloadFormat === "jpeg" ? "jpg" : downloadFormat;
                  const filename = `generated-${result.id.slice(0, 8)}.${ext}`;
                  const nativeFormat = result.image.format.toLowerCase() === "jpg" ? "jpeg" : result.image.format.toLowerCase();
                  if (downloadFormat === nativeFormat && previewSrc) {
                    downloadBlobUrl(previewSrc, filename);
                  } else {
                    const url = `${import.meta.env.VITE_API_URL || "/api/v1"}${result.image.download_url.replace("/api/v1", "")}?format=${downloadFormat}`;
                    await downloadAuthFile(url, filename);
                  }
                })}
                className="flex-1 rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-2.5 text-center font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)] disabled:opacity-60"
              >
                {downloading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Baixando...
                  </span>
                ) : "Download"}
              </button>
              <button
                onClick={reset}
                className="rounded-xl border border-outline-variant/20 px-6 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
              >
                Nova Geração
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
