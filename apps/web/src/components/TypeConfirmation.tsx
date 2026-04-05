import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { fetchImageTypes, processImage } from "@/lib/api";
import { CropModal, type CropCoordinates } from "./CropModal";
import { QualitySelector, type QualityTier } from "./QualitySelector";

const CATEGORY_LABELS: Record<string, string> = {
  admin: "Admin / Branding",
  content: "Conteúdo",
  user: "Usuário",
  gamification: "Gamificação",
};

function TypeIcon({ typeKey }: { typeKey: string }) {
  const iconPaths: Record<string, string> = {
    fundo_login: "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25",
    fundo_login_mobile: "M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3",
    logo_topo: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z",
    logo_relatorios: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
    logo_app: "M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3",
    logo_dispersao: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z",
    favicon: "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418",
    testeira_email: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
    icone_pilula: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5",
    conteudo_imagem: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z",
    capa_workspace: "M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42",
    fundo_workspace: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zM6 10.5h12",
    icone_curso: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
    foto_aluno: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
    // Gamification
    badge_conquista: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
    medalha_ranking: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.375 3.375 0 0013.125 11h-2.25A3.375 3.375 0 007.5 14.25v4.5m6-6V6.75m0 0a2.25 2.25 0 10-4.5 0m4.5 0a2.25 2.25 0 11-4.5 0",
    icone_recompensa: "M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z",
    banner_campanha: "M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5",
    avatar_personagem: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z",
  };

  const path = iconPaths[typeKey] || "M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776";

  return (
    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 border border-primary/20">
      <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </div>
  );
}

type ImageType = {
  id: string;
  category: string;
  typeKey: string;
  displayName: string;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  maxFileSizeKb: number;
  allowedFormats: string[];
  services: string[] | null;
};

export function TypeConfirmation() {
  const { step, selectedTypeId, setSelectedTypeId, uploadId, setStep, setError, originalImage } = useAppStore();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [qualityTier, setQualityTier] = useState<QualityTier>("medium");

  const { data } = useQuery<{ grouped: Record<string, ImageType[]> }>({
    queryKey: ["image-types"],
    queryFn: fetchImageTypes,
  });

  if ((step !== "uploaded" && step !== "cropping") || !data) return null;

  const categories = Object.keys(data.grouped);

  if (!activeTab && categories.length > 0) {
    setActiveTab(categories[0] ?? null);
  }

  // Find the selected type across all categories
  const selectedType = (activeTab && data.grouped[activeTab]?.find(t => t.id === selectedTypeId))
    ?? Object.values(data.grouped).flat().find(t => t.id === selectedTypeId);

  const handleOpenCrop = () => {
    if (!selectedTypeId || !uploadId) return;
    setShowCropModal(true);
    setStep("cropping");
  };

  const doProcess = async (cropData?: CropCoordinates) => {
    if (!selectedTypeId || !uploadId) return;

    setShowCropModal(false);
    setIsProcessing(true);
    setStep("processing");

    try {
      const result = await processImage(uploadId, selectedTypeId, cropData);

      useAppStore.setState({
        processedResult: {
          ...result,
          originalUrl: originalImage?.url,
        },
        step: "processed"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no processamento");
      setStep("uploaded");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCropConfirm = (crop: CropCoordinates) => {
    doProcess(crop);
  };

  const handleCropSkip = () => {
    doProcess();
  };

  const handleCropClose = () => {
    setShowCropModal(false);
    setStep("uploaded");
  };

  return (
    <div className="glass-card space-y-4 rounded-xl p-6">
      <h3 className="text-4xl font-extrabold tracking-tight font-headline text-on-surface">Seleção de Tipo</h3>
      <p className="text-sm text-on-surface-variant">Defina a categoria da imagem para otimização automática.</p>

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 rounded-xl bg-surface-container-low p-1 w-fit">
        {categories.map((cat) => (
          <button
            role="tab"
            aria-selected={activeTab === cat}
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === cat
                ? "bg-surface-container-high text-primary shadow-lg"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
            }`}
          >
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Type Cards Grid */}
      {activeTab && data.grouped[activeTab] && (
        <div role="tabpanel" className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.grouped[activeTab].map((type) => {
            const isSelected = selectedTypeId === type.id;

            return (
              <button
                key={type.id}
                aria-label={type.displayName}
                onClick={() => setSelectedTypeId(type.id)}
                className={`relative rounded-xl border p-6 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-2 border-primary shadow-xl shadow-primary/5"
                    : "bg-surface-container-low hover:bg-surface-container-high border-outline-variant/20"
                }`}
              >
                <TypeIcon typeKey={type.typeKey} />
                <div className="font-headline font-bold text-xl text-on-surface">{type.displayName}</div>
                <div className="mt-1 text-sm text-on-surface-variant">
                  {type.width && type.height
                    ? `${type.width} × ${type.height} px`
                    : "≥200px (variável)"}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-md bg-surface-container-high/80 px-2 py-0.5 text-xs text-on-surface-variant">
                    {type.maxFileSizeKb >= 1024
                      ? `${(type.maxFileSizeKb / 1024).toFixed(0)} MB`
                      : `${type.maxFileSizeKb} KB`}
                  </span>
                  <span className="text-xs text-outline">
                    {type.allowedFormats.join(", ").toUpperCase()}
                  </span>
                </div>
                {type.services && type.services.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {type.services.map((service) => (
                      <span
                        key={service}
                        className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                )}

                {isSelected && (
                  <div className="absolute right-3 top-3">
                    <svg className="h-5 w-5 text-primary drop-shadow-[0_0_4px_rgba(133,173,255,0.5)]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Quality Selector */}
      {selectedTypeId && selectedType && (
        <QualitySelector
          selectedTier={qualityTier}
          onSelect={setQualityTier}
          typeKey={selectedType.typeKey}
        />
      )}

      {/* Process Button */}
      <button
        onClick={handleOpenCrop}
        disabled={!selectedTypeId || isProcessing}
        className="w-full rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-3 text-lg font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
            </svg>
            Processando...
          </span>
        ) : (
          "Processar Imagem"
        )}
      </button>

      {/* Crop Modal */}
      {originalImage && selectedType && (
        <CropModal
          imageSrc={originalImage.url}
          isOpen={showCropModal}
          onClose={handleCropClose}
          onConfirm={handleCropConfirm}
          onSkip={handleCropSkip}
          targetWidth={selectedType.width}
          targetHeight={selectedType.height}
          typeName={selectedType.displayName}
        />
      )}
    </div>
  );
}
