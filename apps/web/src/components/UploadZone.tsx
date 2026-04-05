import { useCallback, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { uploadImage } from "@/lib/api";
import { toast } from "sonner";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function UploadZone() {
  const { step, setUpload, setStep, setError } = useAppStore();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    // Client-side validation
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato não suportado. Aceitos: PNG, JPEG, GIF, WebP");
      toast.error("Formato não suportado", { description: "Aceitos: PNG, JPEG, GIF, WebP" });
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(`Arquivo muito grande. Máximo: ${MAX_SIZE_MB} MB`);
      toast.error("Arquivo muito grande", { description: `Máximo: ${MAX_SIZE_MB} MB` });
      return;
    }

    try {
      // Create local preview URL
      const previewUrl = URL.createObjectURL(file);

      setStep("uploading");

      // Upload to server
      const uploadResult = await uploadImage(file);

      setUpload(uploadResult.id, {
        url: previewUrl,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        sizeKb: uploadResult.sizeKb,
        filename: uploadResult.filename,
        metadata: uploadResult.metadata,
      });

      setStep("uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
      toast.error("Erro no upload", { description: err instanceof Error ? err.message : "Tente novamente" });
      setStep("idle");
    }
  }, [setUpload, setStep, setError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (step !== "idle") return null;

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById("file-input")?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            document.getElementById("file-input")?.click();
          }
        }}
        aria-label="Zona de upload de imagem. Arraste uma imagem ou clique para selecionar"
        className={`
          relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 sm:p-8 md:p-12 transition-all duration-300
          ${isDragOver
            ? "border-primary bg-primary/10 text-primary shadow-[0_0_30px_rgba(133,173,255,0.15)]"
            : "glass-card-hover border-outline/50 text-on-surface-variant hover:border-primary/30 hover:text-on-surface"
          }
        `}
      >
        <div className={`mb-4 rounded-2xl p-4 ${isDragOver ? "bg-primary/20" : "bg-surface-container-high/60"}`}>
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
        </div>
        <p className="mb-1 text-base sm:text-lg font-semibold font-headline">
          {isDragOver ? "Solte a imagem aqui" : "Arraste uma imagem aqui ou clique para selecionar"}
        </p>
        <p className="text-sm text-outline">
          PNG, JPEG, GIF, WebP (Máx. {MAX_SIZE_MB}MB)
        </p>
        <input
          id="file-input"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleInputChange}
          aria-label="Selecionar arquivo de imagem"
          className="hidden"
        />
      </div>
    </div>
  );
}
