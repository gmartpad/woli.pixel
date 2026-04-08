import { useState, useEffect } from "react";
import { useBatchStore } from "@/stores/batch-store";
import { formatSize } from "@/lib/format";
import { downloadBatchZip } from "@/lib/api";
import { downloadAuthFile } from "@/lib/auth-download";
import { useDownload } from "@/hooks/useDownload";
import { FormatSelector } from "@/components/FormatSelector";
import { ImageResultCard } from "./ImageResultCard";
import type { ProcessWizardAction } from "./process-wizard-reducer";
import type { BatchImage } from "@/stores/batch-store";

function useBlobUrl(file: File) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const blobUrl = URL.createObjectURL(file);
    setUrl(blobUrl);
    return () => URL.revokeObjectURL(blobUrl);
  }, [file]);
  return url;
}

type Props = {
  dispatch: React.Dispatch<ProcessWizardAction>;
};

function ProcessedImageRow({
  img,
  index,
  format,
  onFormatChange,
  downloadUrl,
}: {
  img: BatchImage;
  index: number;
  format: string;
  onFormatChange: (fmt: string) => void;
  downloadUrl: string;
}) {
  const blobUrl = useBlobUrl(img.file);
  const result = img.processedResult!;
  const { downloading, trigger: triggerDownload } = useDownload();

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-on-surface truncate">
          {img.file.name}
        </h4>
        <div className="flex items-center gap-3">
          <FormatSelector
            selected={format}
            onChange={onFormatChange}
          />
          <button
            type="button"
            disabled={downloading}
            onClick={() => triggerDownload(async () => {
              const ext = format === "jpeg" ? "jpg" : format;
              await downloadAuthFile(downloadUrl, `${img.file.name.replace(/\.[^.]+$/, "")}.${ext}`);
            })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
          >
            {downloading ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            )}
            {downloading ? "Baixando..." : "Download"}
          </button>
        </div>
      </div>
      <ImageResultCard
        original={{
          url: blobUrl,
          width: img.originalWidth,
          height: img.originalHeight,
          sizeKb: Math.round(img.file.size / 1024),
        }}
        processed={{
          url: result.downloadUrl,
          width: result.width,
          height: result.height,
          sizeKb: result.sizeKb,
        }}
        adjustments={result.adjustments}
        explanation={result.explanation}
      />
    </div>
  );
}

function ErrorImageRow({ img }: { img: BatchImage }) {
  const blobUrl = useBlobUrl(img.file);

  return (
    <div className="glass-card rounded-xl p-6 border border-error/30">
      <div className="flex items-center gap-3">
        <img
          src={blobUrl}
          alt=""
          className="h-10 w-10 rounded object-cover"
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-on-surface">{img.file.name}</p>
          <p className="text-xs text-error">Erro: {img.error || "Falha no processamento"}</p>
        </div>
      </div>
    </div>
  );
}

export function BatchStepResult({ dispatch }: Props) {
  const { images } = useBatchStore();
  const [formats, setFormats] = useState<Record<number, string>>({});
  const [isDownloading, setIsDownloading] = useState(false);

  const processedImages = images.filter((img) => img.processedResult);
  const errorImages = images.filter((img) => img.status === "error");
  const totalOriginalSize = images.reduce((sum, img) => sum + img.file.size / 1024, 0);
  const totalProcessedSize = processedImages.reduce(
    (sum, img) => sum + (img.processedResult?.sizeKb ?? 0),
    0,
  );
  const totalReduction =
    totalOriginalSize > 0
      ? Math.round((1 - totalProcessedSize / totalOriginalSize) * 100)
      : 0;

  function handleReset() {
    useBatchStore.getState().reset();
    dispatch({ type: "RESET" });
  }

  function getDownloadUrl(index: number, baseUrl: string, fallbackFormat: string) {
    const fmt = formats[index] || fallbackFormat;
    return `${baseUrl}?format=${fmt}`;
  }

  async function handleDownloadAll() {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const payload = processedImages
        .map((img, i) => {
          if (!img.uploadId) return null;
          const selectedFormat = formats[images.indexOf(img)] || img.processedResult?.format;
          return { id: img.uploadId, format: selectedFormat };
        })
        .filter((item): item is { id: string; format?: string } => item !== null);

      if (payload.length === 0) return;

      const blob = await downloadBatchZip(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "woli-pixel-images.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao baixar ZIP:", err);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Batch summary header */}
      <div className="glass-card rounded-xl p-6 space-y-3">
        <h3 className="text-lg font-bold font-headline text-on-surface">
          {processedImages.length} imagens processadas
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-surface-container-low p-3">
            <div className="text-2xl font-bold text-on-surface">{images.length}</div>
            <div className="text-xs text-on-surface-variant">Total</div>
          </div>
          <div className="rounded-lg bg-success-container p-3">
            <div className="text-2xl font-bold text-success">{processedImages.length}</div>
            <div className="text-xs text-on-surface-variant">Sucesso</div>
          </div>
          {errorImages.length > 0 && (
            <div className="rounded-lg bg-error/10 p-3">
              <div className="text-2xl font-bold text-error">{errorImages.length}</div>
              <div className="text-xs text-on-surface-variant">Erros</div>
            </div>
          )}
          <div className="rounded-lg bg-primary/10 p-3">
            <div className={`text-2xl font-bold ${totalReduction > 0 ? "text-primary" : "text-red-400"}`}>
              {totalReduction > 0 ? `-${totalReduction}%` : `+${Math.abs(totalReduction)}%`}
            </div>
            <div className="text-xs text-on-surface-variant">Redução Total</div>
          </div>
        </div>
      </div>

      {/* Per-image result cards */}
      {images.map((img, i) => {
        if (img.processedResult) {
          return (
            <ProcessedImageRow
              key={i}
              img={img}
              index={i}
              format={formats[i] || img.processedResult.format}
              onFormatChange={(fmt) => setFormats((prev) => ({ ...prev, [i]: fmt }))}
              downloadUrl={getDownloadUrl(i, img.processedResult.downloadUrl, img.processedResult.format)}
            />
          );
        }

        if (img.status === "error") {
          return <ErrorImageRow key={i} img={img} />;
        }

        return null;
      })}

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleReset}
          className="flex-1 rounded-xl border border-primary/30 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-all"
        >
          Nova Curadoria
        </button>
        <button
          onClick={handleDownloadAll}
          disabled={isDownloading}
          className="flex-1 rounded-xl bg-gradient-to-r from-primary-dim to-primary py-3 text-sm font-semibold text-white shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Gerando ZIP…
            </span>
          ) : (
            "Download Todos"
          )}
        </button>
      </div>
    </div>
  );
}
