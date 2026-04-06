import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchImageTypes } from "@/lib/api";

const CATEGORY_LABELS: Record<string, string> = {
  admin: "Admin / Branding",
  content: "Conteúdo",
  user: "Usuário",
  gamification: "Gamificação",
};

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

type Props = {
  selectedTypeId: string | null;
  onSelectType: (typeId: string) => void;
  suggestedTypeId?: string | null;
};

export function TypeSelector({ selectedTypeId, onSelectType, suggestedTypeId }: Props) {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const { data } = useQuery<{ grouped: Record<string, ImageType[]> }>({
    queryKey: ["image-types"],
    queryFn: fetchImageTypes,
  });

  const categories = data ? Object.keys(data.grouped) : [];

  if (!activeTab && categories.length > 0) {
    // Auto-switch to the tab containing the AI-suggested type
    if (suggestedTypeId && data?.grouped) {
      const suggestedCategory = categories.find((cat) =>
        data.grouped[cat]?.some((t) => t.id === suggestedTypeId),
      );
      setActiveTab(suggestedCategory ?? categories[0] ?? null);
    } else {
      setActiveTab(categories[0] ?? null);
    }
  }

  return (
    <div className="glass-card space-y-4 rounded-xl p-6">
      <h3 className="text-lg font-bold font-headline text-on-surface">
        Seleção de Tipo
      </h3>
      <p className="text-sm text-on-surface-variant">
        Defina a categoria da imagem para otimização automática.
      </p>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <div
          role="tablist"
          className="flex gap-1 rounded-xl bg-surface-container-low p-1 w-fit"
        >
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
      )}

      {/* Type Cards */}
      {activeTab && data?.grouped[activeTab] && (
        <div
          role="tabpanel"
          className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
        >
          {data.grouped[activeTab].map((type) => {
            const isSelected = selectedTypeId === type.id;

            return (
              <button
                key={type.id}
                aria-label={type.displayName}
                onClick={() => onSelectType(type.id)}
                className={`relative rounded-xl border p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-2 border-primary shadow-xl shadow-primary/5"
                    : "bg-surface-container-low hover:bg-surface-container-high border-outline-variant/20"
                }`}
              >
                <div className="font-headline font-bold text-on-surface">
                  {type.displayName}
                </div>
                <div className="mt-1 text-sm text-on-surface-variant">
                  {type.width && type.height
                    ? `${type.width} x ${type.height} px`
                    : "Variável"}
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
                {suggestedTypeId === type.id && (
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Sugerido pela IA
                  </span>
                )}
                {isSelected && (
                  <div className="absolute right-3 top-3">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                        clipRule="evenodd"
                      />
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
