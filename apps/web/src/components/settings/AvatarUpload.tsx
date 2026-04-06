import { useState, useRef } from "react";
import Cropper from "react-easy-crop";
import { toast } from "sonner";
import { getCroppedImg } from "@/lib/crop-image";
import { uploadAvatar } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import type { CroppedArea } from "@/lib/crop-image";

interface AvatarUploadProps {
  session: {
    user: {
      name: string | null;
      email: string;
      image?: string | null;
      [key: string]: unknown;
    };
  };
}

export function AvatarUpload({ session }: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState(session.user.image ?? null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = session.user.name?.slice(0, 2).toUpperCase() || "U";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setImageSrc(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  function handleCropComplete(_: unknown, pixels: CroppedArea) {
    setCroppedAreaPixels(pixels);
  }

  async function handleConfirmCrop() {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const result = await uploadAvatar(croppedBlob);
      setAvatarUrl(result.url);
      setImageSrc(null);

      // Notify session nanostore so all useSession() consumers re-render
      authClient.$store.notify("$sessionSignal");

      toast.success("Foto de perfil atualizada!");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao enviar foto");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleCancelCrop() {
    setImageSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar display */}
      <div className="relative">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-20 w-20 rounded-full object-cover border-2 border-outline-variant/30"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-lg font-bold text-white">
            {initials}
          </div>
        )}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        Alterar foto
      </button>

      {errorMessage && (
        <p className="text-xs text-red-500">{errorMessage}</p>
      )}

      {/* Crop modal */}
      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl bg-surface-container-low p-4 shadow-xl">
            <h3 className="text-sm font-bold text-on-surface mb-3">Recortar foto</h3>

            <div className="relative h-64 w-full rounded-lg overflow-hidden bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-outline">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </div>

            {/* Actions */}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelCrop}
                className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                disabled={isUploading}
                aria-label="Salvar"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isUploading ? "Enviando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
