import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { WizardStepper } from "@/components/ui/WizardStepper";
import { GenerateAccordionSection } from "./GenerateAccordionSection";
import { GenerateSectionPrompt } from "./GenerateSectionPrompt";
import { GenerateSectionType } from "./GenerateSectionType";
import { GenerateSectionQuality } from "./GenerateSectionQuality";
import { GenerateSectionResult } from "./GenerateSectionResult";
import { useGenerationStore } from "@/stores/generation-store";
import { fetchImageTypes } from "@/lib/api";

const STEPS = [
  { label: "Prompt" },
  { label: "Tipo" },
  { label: "Qualidade" },
  { label: "Resultado" },
];

const QUALITY_LABELS: Record<string, string> = {
  low: "Rascunho",
  medium: "Padrão",
  high: "Alta Qualidade",
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

export function GenerateAccordion() {
  const step = useGenerationStore((s) => s.step);
  const prompt = useGenerationStore((s) => s.prompt);
  const selectedTypeId = useGenerationStore((s) => s.selectedTypeId);
  const qualityTier = useGenerationStore((s) => s.qualityTier);
  const generationMode = useGenerationStore((s) => s.generationMode);
  const customWidth = useGenerationStore((s) => s.customWidth);
  const customHeight = useGenerationStore((s) => s.customHeight);

  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  // Fetch image types to derive the selected type name for summary
  const { data: typesData } = useQuery<{ grouped: Record<string, ImageType[]> }>({
    queryKey: ["image-types"],
    queryFn: fetchImageTypes,
  });

  const selectedType = typesData
    ? Object.values(typesData.grouped).flat().find((t) => t.id === selectedTypeId)
    : null;

  // Auto-expand logic
  useEffect(() => {
    if (prompt.length >= 10) {
      setExpandedSections((prev) => new Set([...prev, 1]));
    }
  }, [prompt]);

  useEffect(() => {
    if (selectedTypeId) {
      setExpandedSections((prev) => new Set([...prev, 2]));
    }
  }, [selectedTypeId]);

  useEffect(() => {
    if (step === "completed") {
      setExpandedSections((prev) => new Set([...prev, 3]));
    }
  }, [step]);

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Compute current step for indicator
  const currentStep = step === "completed" || step === "error"
    ? 3
    : selectedTypeId || (generationMode !== "preset" && customWidth && customHeight)
      ? 2
      : prompt.length >= 10
        ? 1
        : 0;

  // Derive type summary
  const typeSummary = selectedType
    ? `${selectedType.displayName}${selectedType.width && selectedType.height ? ` · ${selectedType.width}x${selectedType.height}` : ""}`
    : generationMode === "custom" && customWidth && customHeight
      ? `Personalizado · ${customWidth}x${customHeight}`
      : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="text-center py-2">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-primary font-headline">
          Geração de Imagens por IA
        </h1>
        <p className="mt-2 text-on-surface-variant text-base max-w-xl mx-auto">
          Crie imagens otimizadas para cada preset da plataforma Woli usando modelos de IA de última geração.
        </p>
      </div>

      <WizardStepper steps={STEPS} currentStep={currentStep} />

      <GenerateAccordionSection
        stepNumber={1}
        title="Descreva a Imagem"
        isExpanded={expandedSections.has(0)}
        isComplete={prompt.length >= 10}
        onToggle={() => toggleSection(0)}
        summary={
          prompt.length >= 10
            ? prompt.slice(0, 50) + (prompt.length > 50 ? "..." : "")
            : undefined
        }
      >
        <GenerateSectionPrompt />
      </GenerateAccordionSection>

      <GenerateAccordionSection
        stepNumber={2}
        title="Tipo da Imagem"
        isExpanded={expandedSections.has(1)}
        isComplete={!!selectedTypeId || generationMode === "custom"}
        onToggle={() => toggleSection(1)}
        summary={typeSummary}
      >
        <GenerateSectionType />
      </GenerateAccordionSection>

      <GenerateAccordionSection
        stepNumber={3}
        title="Qualidade e Geração"
        isExpanded={expandedSections.has(2)}
        isComplete={step === "completed"}
        onToggle={() => toggleSection(2)}
        summary={QUALITY_LABELS[qualityTier] || qualityTier}
      >
        <GenerateSectionQuality />
      </GenerateAccordionSection>

      <GenerateAccordionSection
        stepNumber={4}
        title="Resultado"
        isExpanded={expandedSections.has(3)}
        isComplete={step === "completed"}
        onToggle={() => toggleSection(3)}
      >
        <GenerateSectionResult />
      </GenerateAccordionSection>
    </div>
  );
}
