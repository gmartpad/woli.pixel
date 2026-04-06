import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

type CropUploadZoneProps = {
  onImageLoaded: (data: {
    imageSrc: string;
    fileName: string;
    mimeType: string;
    naturalWidth: number;
    naturalHeight: number;
  }) => void;
  onError: (message: string) => void;
};

export function CropUploadZone({ onImageLoaded, onError }: CropUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateAndLoad(file: File) {
    if (!ALLOWED_TYPES.has(file.type)) {
      onError("Formato não suportado. Use PNG, JPEG, GIF ou WebP.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      onError("Arquivo excede o limite de 10MB.");
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      onImageLoaded({
        imageSrc: blobUrl,
        fileName: file.name,
        mimeType: file.type,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      onError("Não foi possível carregar a imagem.");
    };
    img.src = blobUrl;
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndLoad(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndLoad(file);
    e.target.value = "";
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-colors cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-high",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <svg className="h-12 w-12 text-on-surface-variant/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium text-on-surface">
          Arraste uma imagem ou clique para selecionar
        </p>
        <p className="text-xs text-on-surface-variant mt-1">
          PNG, JPEG, GIF ou WebP — até 10MB
        </p>
      </div>
    </div>
  );
}
