import { useGenerationStore } from "@/stores/generation-store";

export function GenerateSectionPrompt() {
  const prompt = useGenerationStore((s) => s.prompt);
  const setPrompt = useGenerationStore((s) => s.setPrompt);

  return (
    <div className="space-y-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Descreva a imagem que deseja gerar... (mínimo 10 caracteres)"
        rows={3}
        className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-4 py-3 text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />
      {prompt.length > 0 && prompt.length < 10 && (
        <p className="text-xs text-outline">
          {10 - prompt.length} caracteres restantes para o mínimo
        </p>
      )}
    </div>
  );
}
