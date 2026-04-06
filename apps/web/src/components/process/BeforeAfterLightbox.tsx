import { useState, useEffect, useRef } from "react";

type BeforeAfterLightboxProps = {
  originalSrc: string;
  processedSrc: string;
  initialSlide: 0 | 1;
  onClose: () => void;
};

const SLIDES = [
  { label: "ANTES", key: "original" },
  { label: "DEPOIS", key: "processed" },
] as const;

export function BeforeAfterLightbox({
  originalSrc,
  processedSrc,
  initialSlide,
  onClose,
}: BeforeAfterLightboxProps) {
  const [slide, setSlide] = useState(initialSlide);
  const dialogRef = useRef<HTMLDivElement>(null);

  const sources = [originalSrc, processedSrc];
  const current = SLIDES[slide];

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowRight":
          setSlide(1);
          break;
        case "ArrowLeft":
          setSlide(0);
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function goNext() {
    setSlide((s) => (s === 1 ? 0 : 1));
  }

  function goPrev() {
    setSlide((s) => (s === 0 ? 1 : 0));
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 outline-none"
      onClick={handleBackdropClick}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>

        <span className="text-sm font-medium text-white/85">
          {current.label}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Anterior"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Próximo"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            →
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4">
        <img
          src={sources[slide]}
          alt={current.label === "ANTES" ? "Original" : "Processada"}
          className="max-h-full max-w-[90vw] object-contain"
        />
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 pb-4">
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            data-testid="dot-indicator"
            onClick={() => setSlide(i as 0 | 1)}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              i === slide ? "bg-white" : "bg-white/30"
            }`}
            aria-label={s.label}
          />
        ))}
      </div>
    </div>
  );
}
