import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, type PixelCrop, makeAspectCrop, centerCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropModalProps {
  imageSrc: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (crop: CropCoordinates) => void;
  onSkip: () => void;
  targetWidth: number | null;
  targetHeight: number | null;
  typeName: string;
}

export function computeUpscaleStatus(
  displayWidth: number,
  displayHeight: number,
  targetWidth: number | null,
  targetHeight: number | null,
): { needsUpscale: boolean; scalePercent: number } {
  if (!targetWidth || !targetHeight || displayWidth === 0) {
    return { needsUpscale: false, scalePercent: 0 };
  }
  const widthRatio = targetWidth / displayWidth;
  const heightRatio = targetHeight / displayHeight;
  const maxRatio = Math.max(widthRatio, heightRatio);
  return {
    needsUpscale: maxRatio > 1,
    scalePercent: maxRatio > 1 ? Math.round((maxRatio - 1) * 100) : 0,
  };
}

function computeRatioLabel(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

export function CropModal({
  imageSrc,
  isOpen,
  onClose,
  onConfirm,
  onSkip,
  targetWidth,
  targetHeight,
  typeName,
}: CropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<Element | null>(null);
  const pointerDownTarget = useRef<EventTarget | null>(null);
  const [imgMaxHeight, setImgMaxHeight] = useState<number | null>(null);

  const hasFixedAspect = targetWidth !== null && targetHeight !== null;
  const aspect = hasFixedAspect ? targetWidth / targetHeight : undefined;
  const ratioLabel = hasFixedAspect ? computeRatioLabel(targetWidth, targetHeight) : null;

  // Compute natural-pixel dimensions from the completed crop (zoom-adjusted)
  const scaleX = imgRef.current ? imgRef.current.naturalWidth / imgRef.current.width : 1;
  const scaleY = imgRef.current ? imgRef.current.naturalHeight / imgRef.current.height : 1;
  const displayWidth = completedCrop ? Math.round((completedCrop.width / zoom) * scaleX) : 0;
  const displayHeight = completedCrop ? Math.round((completedCrop.height / zoom) * scaleY) : 0;

  const { needsUpscale, scalePercent } = computeUpscaleStatus(displayWidth, displayHeight, targetWidth, targetHeight);

  // Focus management & body scroll lock
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      setTimeout(() => closeButtonRef.current?.focus(), 10);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setZoom(1);
    }
  }, [isOpen, imageSrc]);

  // Measure toolbar height and compute available space for the image
  useLayoutEffect(() => {
    if (!isOpen) {
      setImgMaxHeight(null);
      return;
    }
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const TOP_PAD = 64;
    const BOTTOM_GAP = 16;
    const TOOLBAR_MARGIN = 16;

    function measure() {
      if (!toolbar) return;
      const available = window.innerHeight - TOP_PAD - BOTTOM_GAP - toolbar.offsetHeight - TOOLBAR_MARGIN;
      setImgMaxHeight(Math.max(available, 120));
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(toolbar);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isOpen]);

  // Keyboard handling (Escape + focus trap)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      imgRef.current = img;
      const { width, height } = img;

      if (aspect) {
        const newCrop = centerCrop(
          makeAspectCrop({ unit: "px", width: width * 0.8 }, aspect, width, height),
          width,
          height,
        );
        setCrop(newCrop);
        setCompletedCrop({ ...newCrop, unit: "px" });
      } else {
        const cropWidth = width * 0.9;
        const cropHeight = height * 0.9;
        const initialCrop: Crop = {
          unit: "px",
          x: (width - cropWidth) / 2,
          y: (height - cropHeight) / 2,
          width: cropWidth,
          height: cropHeight,
        };
        setCrop(initialCrop);
        setCompletedCrop({
          unit: "px",
          x: (width - cropWidth) / 2,
          y: (height - cropHeight) / 2,
          width: cropWidth,
          height: cropHeight,
        });
      }
    },
    [aspect],
  );

  const handleConfirm = useCallback(() => {
    if (!completedCrop || !imgRef.current) return;

    const img = imgRef.current;
    const sx = img.naturalWidth / img.width;
    const sy = img.naturalHeight / img.height;
    const naturalCrop: CropCoordinates = {
      x: Math.round((completedCrop.x / zoom) * sx),
      y: Math.round((completedCrop.y / zoom) * sy),
      width: Math.round((completedCrop.width / zoom) * sx),
      height: Math.round((completedCrop.height / zoom) * sy),
    };
    onConfirm(naturalCrop);
  }, [completedCrop, zoom, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={`Recortar para: ${typeName}`}
      onPointerDown={(e) => {
        pointerDownTarget.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pointerDownTarget.current === e.currentTarget) {
          onClose();
        }
        pointerDownTarget.current = null;
      }}
    >
      {/* Close button (top-right) */}
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        aria-label="Fechar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Title pill (top-center) */}
      <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-surface-container/80 px-4 py-2 backdrop-blur-md">
        <span className="text-sm text-on-surface">Recortar para: {typeName}</span>
      </div>

      {/* Crop area */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pt-16 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          minWidth={50}
          minHeight={50}
          aspect={aspect}
          style={imgMaxHeight !== null ? { maxHeight: imgMaxHeight } : undefined}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt=""
            className="max-w-[90vw]"
            style={{
              maxHeight: imgMaxHeight !== null ? imgMaxHeight : "60vh",
              transform: `scale(${zoom})`,
            }}
            onLoad={onImageLoad}
          />
        </ReactCrop>
      </div>

      {/* Toolbar */}
      <div
        ref={toolbarRef}
        className="mx-4 mb-4 shrink-0 rounded-2xl bg-surface-container/80 px-5 py-4 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Row 1: Ratio label + Zoom */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {/* Aspect ratio indicator */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-on-surface-variant">
              Proporção:
            </span>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              {ratioLabel ?? "Livre"}
            </span>
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <label htmlFor="crop-zoom" className="text-xs font-medium whitespace-nowrap text-on-surface-variant">
              Zoom:
            </label>
            <input
              id="crop-zoom"
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="accent-primary h-1.5 flex-1"
            />
            <span className="w-10 text-right text-xs text-on-surface-variant tabular-nums">{zoom.toFixed(1)}x</span>
          </div>
        </div>

        {/* Row 2: Dimensions + Action buttons */}
        <div className="mt-3 flex items-center justify-between">
          {/* Dimensions indicator */}
          <div className="text-xs">
            {completedCrop ? (
              <div className="flex items-center gap-2">
                <span className={needsUpscale ? "text-warning" : "text-on-surface-variant"}>
                  {displayWidth} × {displayHeight} px
                </span>
                {needsUpscale && (
                  <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    Será ampliada ~{scalePercent}%
                  </span>
                )}
              </div>
            ) : (
              <span className="text-on-surface-variant/40">&nbsp;</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              Pular Recorte
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!completedCrop}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:brightness-110 disabled:opacity-50"
            >
              Aplicar e Processar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
