import { useCallback, useState } from "react";
import { uploadImage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useBatchStore } from "@/stores/batch-store";
import type { ProcessWizardState, ProcessWizardAction } from "./process-wizard-reducer";

function StagedFileCard({ file, index, onRemove }: {
  file: File;
  index: number;
  onRemove: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [objectUrl] = useState(() => URL.createObjectURL(file));

  return (
    <div className="relative group min-w-0 rounded-lg border border-outline-variant/10 bg-surface-container-high p-1.5">
      {!loaded && (
        <div
          data-testid={`skeleton-${index}`}
          className="h-14 w-full animate-pulse rounded bg-surface-container-highest"
        >
          <div className="flex h-full items-center justify-center">
            <div role="status" className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </div>
      )}
      <img
        src={objectUrl}
        alt={file.name}
        className={cn("h-14 w-full object-cover rounded", !loaded && "hidden")}
        onLoad={() => setLoaded(true)}
      />
      <p className="text-[9px] text-on-surface-variant mt-1 truncate">{file.name}</p>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
        aria-label={`Remover ${file.name}`}
        className="absolute -right-1.5 -top-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-error text-white text-xs"
      >
        x
      </button>
    </div>
  );
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

type Props = {
  state: ProcessWizardState;
  dispatch: React.Dispatch<ProcessWizardAction>;
};

export function ProcessStepUpload({ state, dispatch }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  const stageFiles = useCallback(
    (files: File[]) => {
      const validFiles = files.filter((file) => {
        if (!ACCEPTED_TYPES.includes(file.type)) return false;
        if (file.size > MAX_SIZE_BYTES) return false;
        return true;
      });

      if (validFiles.length === 0 && files.length > 0) {
        dispatch({
          type: "SET_ERROR",
          error: files.length === 1 && !ACCEPTED_TYPES.includes(files[0].type)
            ? "Formato não suportado. Aceitos: PNG, JPEG, GIF, WebP"
            : files.length === 1
              ? `Arquivo muito grande. Máximo: ${MAX_SIZE_MB} MB`
              : "Nenhum arquivo válido. Aceitos: PNG, JPEG, GIF, WebP (máx. 10 MB)",
        });
        return;
      }

      setStagedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const newFiles = validFiles.filter((f) => !existingNames.has(f.name));
        return [...prev, ...newFiles];
      });
    },
    [dispatch],
  );

  const removeStaged = useCallback((index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleContinue = useCallback(async () => {
    if (stagedFiles.length === 0) return;

    // Multiple files → batch mode
    if (stagedFiles.length > 1) {
      useBatchStore.getState().addFiles(stagedFiles);
      dispatch({ type: "SET_BATCH_MODE" });
      return;
    }

    // Single file → reset any stale batch state and upload
    useBatchStore.getState().reset();
    const file = stagedFiles[0];
    try {
      dispatch({ type: "SET_UPLOADING", value: true });

      const previewUrl = URL.createObjectURL(file);
      const uploadResult = await uploadImage(file);

      dispatch({
        type: "SET_FILE",
        uploadId: uploadResult.id,
        image: {
          url: previewUrl,
          filename: uploadResult.filename,
          width: uploadResult.width,
          height: uploadResult.height,
          sizeKb: uploadResult.sizeKb,
          format: uploadResult.format,
        },
      });

      dispatch({ type: "SET_STEP", step: 1 });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Erro no upload",
      });
    }
  }, [stagedFiles, dispatch]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) stageFiles(files);
    },
    [stageFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) stageFiles(files);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [stageFiles],
  );

  if (state.isUploading) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-xl py-12">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_20px_rgba(133,173,255,0.3)]" />
        <p className="text-lg font-semibold text-primary font-headline">
          Enviando imagem...
        </p>
        <p className="text-sm text-on-surface-variant">
          Aguarde enquanto processamos o upload
        </p>
      </div>
    );
  }

  if (state.error && state.step === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-xl py-12 space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container/30">
          <svg
            className="h-6 w-6 text-error"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <p className="text-sm text-error">{state.error}</p>
        <button
          onClick={() => dispatch({ type: "SET_ERROR", error: "" })}
          className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop zone — always visible for adding more files */}
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() =>
          document.getElementById("wizard-file-input")?.click()
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            document.getElementById("wizard-file-input")?.click();
          }
        }}
        aria-label="Zona de upload de imagens. Arraste imagens ou clique para selecionar"
        className={`
          relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300
          ${stagedFiles.length > 0 ? "p-4 sm:p-5" : "p-6 sm:p-8 md:p-12"}
          ${
            isDragOver
              ? "border-primary bg-primary/10 text-primary shadow-[0_0_30px_rgba(133,173,255,0.15)]"
              : "glass-card-hover border-outline/50 text-on-surface-variant hover:border-primary/30 hover:text-on-surface"
          }
        `}
      >
        <div
          className={`mb-3 rounded-2xl p-3 ${stagedFiles.length > 0 ? "mb-1 p-2" : ""} ${isDragOver ? "bg-primary/20" : "bg-surface-container-high/60"}`}
        >
          <svg
            className={stagedFiles.length > 0 ? "h-6 w-6" : "h-10 w-10"}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
            />
          </svg>
        </div>
        <p className={`mb-1 font-semibold font-headline ${stagedFiles.length > 0 ? "text-sm" : "text-base sm:text-lg"}`}>
          {isDragOver
            ? "Solte as imagens aqui"
            : stagedFiles.length > 0
              ? "Arraste mais imagens ou clique para adicionar"
              : "Arraste imagens aqui ou clique para selecionar"}
        </p>
        {stagedFiles.length === 0 && (
          <>
            <p className="text-sm text-outline">
              PNG, JPEG, GIF, WebP (Máx. {MAX_SIZE_MB}MB)
            </p>
            <p className="mt-1 text-xs text-outline/70">
              1 imagem = curadoria detalhada · Várias = processamento em lote
            </p>
          </>
        )}
        <input
          id="wizard-file-input"
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
          onChange={handleInputChange}
          aria-label="Selecionar arquivos de imagem"
          className="hidden"
        />
      </div>

      {/* Staged files preview */}
      {stagedFiles.length > 0 && (
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-on-surface">
              {stagedFiles.length} {stagedFiles.length === 1 ? "imagem selecionada" : "imagens selecionadas"}
            </p>
            <p className="text-xs text-on-surface-variant">
              {stagedFiles.length === 1 ? "Curadoria detalhada" : "Processamento em lote"}
            </p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {stagedFiles.map((file, i) => (
              <StagedFileCard key={`${file.name}-${i}`} file={file} index={i} onRemove={removeStaged} />
            ))}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleContinue(); }}
            className="w-full rounded-xl bg-gradient-to-r from-primary-dim to-primary py-3 text-sm font-semibold text-white shadow-lg hover:shadow-primary/25 transition-all"
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
