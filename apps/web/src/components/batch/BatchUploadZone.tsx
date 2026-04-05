import { useCallback } from "react";
import { useBatchStore } from "@/stores/batch-store";

export function BatchUploadZone() {
  const { images, addFiles, removeFile, batchStep } = useBatchStore();

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(f.type)
      );
      if (files.length > 0) addFiles(files);
    },
    [addFiles]
  );

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  if (batchStep !== "idle" && batchStep !== "selecting") return null;

  const totalSize = images.reduce((sum, img) => sum + img.file.size, 0);

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="text-2xl font-bold font-headline text-on-surface">Upload em Lote</h3>
      <p className="text-sm text-on-surface-variant">Arraste múltiplas imagens ou selecione arquivos para validação em massa.</p>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative flex min-h-[160px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low/50 transition-colors hover:border-primary/50 hover:bg-primary/5"
      >
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleSelect}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <div className="text-center p-4">
          <svg className="mx-auto h-10 w-10 text-outline mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          <p className="text-sm text-on-surface-variant">Arraste imagens aqui ou clique para selecionar</p>
          <p className="text-xs text-outline mt-1">PNG, JPEG, GIF, WebP · até 10MB cada</p>
        </div>
      </div>

      {images.length > 0 && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">
              {images.length} {images.length === 1 ? "arquivo" : "arquivos"} · {(totalSize / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
            {images.map((img, i) => (
              <div key={img.file.name + i} className="relative group rounded-lg overflow-hidden bg-surface-container-low border border-outline-variant/10">
                <img
                  src={URL.createObjectURL(img.file)}
                  alt={img.file.name}
                  className="h-24 w-full object-cover"
                />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-error/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  &times;
                </button>
                <div className="px-2 py-1">
                  <p className="text-[10px] text-on-surface-variant truncate">{img.file.name}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
