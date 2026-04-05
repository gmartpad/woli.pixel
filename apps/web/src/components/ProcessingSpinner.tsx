import { useAppStore } from "@/stores/app-store";

export function ProcessingSpinner() {
  const { step } = useAppStore();

  if (step !== "processing") return null;

  return (
    <div className="glass-card flex flex-col items-center justify-center rounded-xl py-12">
      <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_20px_rgba(133,173,255,0.3)]" />
      <p className="text-lg font-semibold text-primary font-headline">Processando imagem...</p>
      <p className="text-sm text-on-surface-variant">Redimensionando, convertendo e otimizando</p>
    </div>
  );
}
