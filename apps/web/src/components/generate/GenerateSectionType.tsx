import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGenerationStore } from "@/stores/generation-store";
import { fetchImageTypes } from "@/lib/api";
import { CustomResolutionInput } from "@/components/CustomResolutionInput";
import { StyleSelector } from "@/components/StyleSelector";
import { CustomPresetManager } from "@/components/CustomPresetManager";
import type { CustomStyle } from "@/stores/generation-store";

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

export function GenerateSectionType() {
  const selectedTypeId = useGenerationStore((s) => s.selectedTypeId);
  const setSelectedTypeId = useGenerationStore((s) => s.setSelectedTypeId);
  const customWidth = useGenerationStore((s) => s.customWidth);
  const customHeight = useGenerationStore((s) => s.customHeight);
  const customStyle = useGenerationStore((s) => s.customStyle);
  const customPresetId = useGenerationStore((s) => s.customPresetId);
  const setCustomDimensions = useGenerationStore((s) => s.setCustomDimensions);
  const setCustomStyle = useGenerationStore((s) => s.setCustomStyle);
  const setCustomPresetId = useGenerationStore((s) => s.setCustomPresetId);

  const [activeTab, setActiveTab] = useState<string | null>(null);

  const { data: typesData } = useQuery<{ grouped: Record<string, ImageType[]> }>({
    queryKey: ["image-types"],
    queryFn: fetchImageTypes,
  });

  const categories = typesData ? Object.keys(typesData.grouped) : [];
  if (!activeTab && categories.length > 0) {
    setActiveTab(categories[0] ?? null);
  }

  return (
    <div className="space-y-4">
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
  );
}
