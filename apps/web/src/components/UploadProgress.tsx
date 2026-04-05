import { useAppStore } from "@/stores/app-store";

export function UploadProgress() {
  const { step } = useAppStore();

  if (step !== "uploading") return null;

  return (
    <div className="glass-card flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 p-12">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_15px_rgba(133,173,255,0.3)]" />
      <p className="text-lg font-semibold text-primary font-headline">Enviando imagem...</p>
      <p className="text-sm text-on-surface-variant">Aguarde enquanto processamos o upload</p>
    </div>
  );
}
