import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/stores/app-store";

export function FileInfo() {
  const { originalImage, step } = useAppStore();
  const [showLightbox, setShowLightbox] = useState(false);
  const [showExif, setShowExif] = useState(false);

  useEffect(() => {
    if (!showLightbox) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLightbox(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showLightbox]);

  if (!originalImage || step === "idle") return null;

  const formatSize = (kb: number) => {
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${kb} KB`;
  };

  const meta = originalImage.metadata;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {/* Left: Thumbnail */}
        <div
          className="bg-surface-container-high rounded-xl overflow-hidden shadow-2xl shadow-black/40 cursor-pointer group self-start"
          onClick={() => setShowLightbox(true)}
        >
          <div className="aspect-square relative overflow-hidden">
            <img
              src={originalImage.url}
              alt={originalImage.filename}
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-4 left-4 bg-primary/20 backdrop-blur-md text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/30">
              PREVIEW ATIVO
            </span>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
              <div className="rounded-full bg-black/50 backdrop-blur-sm p-3">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Metadata */}
        <div className="bg-surface-container-high p-8 rounded-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="text-xs font-bold tracking-widest uppercase text-on-surface-variant">
              Metadados do Arquivo
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-on-surface-variant block mb-1">Nome</span>
                <span className="text-xl font-bold font-headline text-on-surface truncate block">{originalImage.filename}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Dimensões</span>
                <span className="font-mono text-on-surface">{originalImage.width} × {originalImage.height} px</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Formato</span>
                <span className="rounded-lg bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-400 uppercase">
                  {originalImage.format}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Tamanho</span>
                <span className={`font-mono ${originalImage.sizeKb > 500 ? "rounded-lg bg-error-container/30 text-error px-2.5 py-0.5 text-xs" : "text-on-surface"}`}>
                  {formatSize(originalImage.sizeKb)}
                </span>
              </div>
            </div>
          </div>

          {/* Divider + Exif button */}
          <div className="mt-6">
            <div className="border-t border-outline-variant/20 mb-4" />
            <button
              onClick={() => setShowExif(!showExif)}
              className="w-full rounded-xl border border-outline-variant/30 bg-surface-container/60 py-2.5 text-sm font-medium text-primary hover:bg-surface-bright transition-colors flex items-center justify-center gap-2"
            >
              <svg className={`h-4 w-4 transition-transform ${showExif ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
              {showExif ? "Ocultar Detalhes" : "Ver Detalhes Exif"}
            </button>

            {showExif && (
              <div className="mt-4 rounded-xl bg-surface-container-lowest p-4 space-y-2 text-sm">
                {meta ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">DPI</span>
                      <span className="font-mono text-on-surface">{meta.density ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Espaço de Cor</span>
                      <span className="font-mono text-on-surface">{meta.space ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Canais</span>
                      <span className="font-mono text-on-surface">{meta.channels ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Profundidade</span>
                      <span className="font-mono text-on-surface">{meta.depth ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Canal Alpha</span>
                      <span className="font-mono text-on-surface">{meta.hasAlpha ? "Sim" : "Não"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Perfil ICC</span>
                      <span className="font-mono text-on-surface">{meta.hasProfile ? "Sim" : "Não"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Progressivo</span>
                      <span className="font-mono text-on-surface">{meta.isProgressive ? "Sim" : "Não"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Orientação</span>
                      <span className="font-mono text-on-surface">{meta.orientation ?? "—"}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-on-surface-variant text-center py-2">
                    Metadados EXIF não disponíveis para esta imagem.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {showLightbox && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowLightbox(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img
              src={originalImage.url}
              alt={originalImage.filename}
              className="max-w-full max-h-[90vh] object-contain rounded-xl"
            />
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface shadow-lg hover:bg-surface-bright transition-colors"
            >
              ✕
            </button>
            <div className="absolute bottom-4 left-4 rounded-lg bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs text-white">
              {originalImage.filename} — {originalImage.width} × {originalImage.height} px
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
