import { useState, useEffect, useRef } from "react";
import { useAuthImage } from "@/hooks/useAuthImage";

type Props = {
  imageUrl: string;
  alt: string;
  mode: "single" | "compare";
  originalImageUrl?: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentIndex: number;
  totalItems: number;
};

export function HistoryLightbox({
  imageUrl,
  alt,
  mode,
  originalImageUrl,
  onClose,
  onPrev,
  onNext,
  currentIndex,
  totalItems,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPosition, setSliderPosition] = useState(50);

  // URLs are already fully constructed by the parent — just authenticate them
  const { src: imageSrc } = useAuthImage(imageUrl);
  const { src: originalSrc } = useAuthImage(originalImageUrl ?? null);

  const showComparison = mode === "compare" && originalSrc;

  // Auto-focus dialog on mount
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          onPrev();
          break;
        case "ArrowRight":
          onNext();
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext]);

  function handleMouseDown() {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      setSliderPosition((x / rect.width) * 100);
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 outline-none"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Close button (left) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>

        {/* Position indicator (center) */}
        <span className="text-sm font-medium text-white/85">
          {currentIndex + 1} / {totalItems}
        </span>

        {/* Navigation arrows (right) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Anterior"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Próximo"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            →
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 items-center justify-center px-4 pb-4">
        {showComparison ? (
          <div
            ref={containerRef}
            data-testid="comparison-slider"
            className="relative max-h-[80vh] max-w-[90vw] cursor-col-resize select-none overflow-hidden"
          >
            {/* Original image (left, clipped from right) */}
            <div className="absolute inset-0">
              <img
                src={originalSrc}
                alt={`${alt} - Original`}
                className="h-full w-full object-contain"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                draggable={false}
              />
            </div>

            {/* Processed image (right, full) */}
            <img
              src={imageSrc}
              alt={alt}
              className="block max-h-[80vh] max-w-[90vw] object-contain"
              draggable={false}
            />

            {/* Draggable handle */}
            <div
              className="absolute top-0 bottom-0 z-10 w-1 cursor-col-resize bg-white/80"
              style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
              onMouseDown={handleMouseDown}
            >
              <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
                <span className="text-xs text-black/60">⇔</span>
              </div>
            </div>

            {/* Labels */}
            <span className="absolute top-3 left-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              Original
            </span>
            <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              Processado
            </span>
          </div>
        ) : imageSrc ? (
          <img
            src={imageSrc}
            alt={alt}
            className="max-h-[80vh] max-w-[90vw] object-contain"
          />
        ) : (
          <div className="flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
