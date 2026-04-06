import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "@/lib/crop-image";
import { authClient } from "@/lib/auth-client";
import {
  fetchAvatarHistory,
  uploadAvatar,
  restoreAvatar,
  deleteAvatar,
  bulkDeleteAvatars,
} from "@/lib/api";
import { AvatarHistoryGrid } from "./AvatarHistoryGrid";
import type { CroppedArea } from "@/lib/crop-image";

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarId: string | null;
  session: {
    user: {
      name: string | null;
      email: string;
      image?: string | null;
    };
  };
}

type Tab = "history" | "upload";

export function AvatarPickerModal({
  isOpen,
  onClose,
  currentAvatarId,
  session,
}: AvatarPickerModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Upload tab state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ["avatar-history"],
    queryFn: fetchAvatarHistory,
    staleTime: 30_000,
    enabled: isOpen,
  });

  const restoreMutation = useMutation({
    mutationFn: restoreAvatar,
    onSuccess: () => {
      authClient.$store.notify("$sessionSignal");
      queryClient.invalidateQueries({ queryKey: ["avatar-history"] });
      toast.success("Foto de perfil atualizada!");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: (result) => {
      if (result.clearedCurrent) authClient.$store.notify("$sessionSignal");
      queryClient.invalidateQueries({ queryKey: ["avatar-history"] });
      toast.success("Foto excluída");
      setConfirmDeleteId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteAvatars,
    onSuccess: (result) => {
      if (result.clearedCurrent) authClient.$store.notify("$sessionSignal");
      queryClient.invalidateQueries({ queryKey: ["avatar-history"] });
      toast.success(`${result.deleted} foto(s) excluída(s)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      authClient.$store.notify("$sessionSignal");
      queryClient.invalidateQueries({ queryKey: ["avatar-history"] });
      toast.success("Foto de perfil atualizada!");
      setImageSrc(null);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!isOpen) return null;

  function handleFile(file: File) {
    setImageSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Formato não suportado", { description: "Envie uma imagem" });
      return;
    }
    handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleCropComplete(_: unknown, pixels: CroppedArea) {
    setCroppedAreaPixels(pixels);
  }

  async function handleConfirmCrop() {
    if (!imageSrc || !croppedAreaPixels) return;
    const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
    uploadMutation.mutate(croppedBlob);
  }

  function handleDeleteAvatar(id: string) {
    if (id === currentAvatarId) {
      setConfirmDeleteId(id);
    } else {
      deleteMutation.mutate(id);
    }
  }

  function handleSaveSelection() {
    if (selectedAvatarId && selectedAvatarId !== currentAvatarId) {
      restoreMutation.mutate(selectedAvatarId);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-surface-container-low shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-bold text-on-surface">
            Alterar foto de perfil
          </h3>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full text-outline hover:bg-surface-container-high transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex border-b border-outline-variant/20 px-4"
          role="tablist"
        >
          <button
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-outline hover:text-on-surface"
            }`}
          >
            Histórico
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "upload"}
            onClick={() => setActiveTab("upload")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "upload"
                ? "border-primary text-primary"
                : "border-transparent text-outline hover:text-on-surface"
            }`}
          >
            Enviar nova
          </button>
        </div>

        {/* History tab */}
        {activeTab === "history" && (
          <>
            <AvatarHistoryGrid
              avatars={historyQuery.data ?? []}
              currentAvatarId={currentAvatarId}
              onSelect={(id) => setSelectedAvatarId(id)}
              onDelete={handleDeleteAvatar}
              onBulkDelete={(ids) => bulkDeleteMutation.mutate(ids)}
              isLoading={historyQuery.isLoading}
            />
            {selectedAvatarId && selectedAvatarId !== currentAvatarId && (
              <div className="flex justify-end gap-2 px-4 pb-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSelection}
                  disabled={restoreMutation.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {restoreMutation.isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            )}
          </>
        )}

        {/* Upload tab */}
        {activeTab === "upload" && (
          <div className="p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {!imageSrc ? (
              <div
                role="button"
                tabIndex={0}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label="Zona de upload. Arraste uma imagem ou clique para selecionar"
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all duration-300 ${
                  isDragOver
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline/50 text-on-surface-variant hover:border-primary/30 hover:text-on-surface"
                }`}
              >
                <div className={`mb-3 rounded-2xl p-3 ${isDragOver ? "bg-primary/20" : "bg-surface-container-high/60"}`}>
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                </div>
                <p className="mb-1 text-sm font-semibold">
                  {isDragOver ? "Solte a imagem aqui" : "Arraste uma imagem aqui"}
                </p>
                <p className="text-xs text-outline">ou clique para selecionar</p>
              </div>
            ) : (
              <>
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
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImageSrc(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCrop}
                    disabled={uploadMutation.isPending}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {uploadMutation.isPending ? "Enviando..." : "Salvar"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Confirm delete current avatar */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
            <div className="w-full max-w-xs rounded-xl bg-surface-container-low p-4 shadow-xl">
              <p className="text-sm text-on-surface">
                Esta é sua foto atual. Ao excluir, seu perfil usará suas
                iniciais. Continuar?
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
                  }}
                  disabled={deleteMutation.isPending}
                  className="rounded-lg bg-error px-3 py-1.5 text-sm font-bold text-white hover:bg-error/90 disabled:opacity-50 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
