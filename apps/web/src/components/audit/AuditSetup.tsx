import { useState, useCallback } from "react";
import { useAuditStore } from "@/stores/audit-store";
import { createAudit, uploadAuditImages, addAuditUrls, startAuditScan } from "@/lib/api";

export function AuditSetup() {
  const { step, setStep, setCurrentJob } = useAuditStore();
  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState(7);
  const [sourceTab, setSourceTab] = useState<"files" | "urls">("files");
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState("");
  const [loading, setLoading] = useState(false);

  if (step !== "idle" && step !== "setup") return null;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(f.type)
    );
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    try {
      const job = await createAudit(name, undefined, threshold);
      setCurrentJob(job);

      if (sourceTab === "files" && files.length > 0) {
        await uploadAuditImages(job.id, files);
      } else if (sourceTab === "urls" && urls.trim()) {
        const urlList = urls.split("\n").map((u) => u.trim()).filter(Boolean);
        await addAuditUrls(job.id, urlList);
      }

      await startAuditScan(job.id);
      setStep("scanning");
    } catch (err) {
      console.error("Audit start error:", err);
    } finally {
      setLoading(false);
    }
  };

  const hasContent = sourceTab === "files" ? files.length > 0 : urls.trim().length > 0;

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="text-2xl font-bold font-headline text-on-surface">Nova Auditoria</h3>
      <p className="text-sm text-on-surface-variant">Escaneie imagens existentes de um catálogo para identificar problemas de qualidade.</p>

      <input
        value={name}
        onChange={(e) => { setName(e.target.value); if (step === "idle") setStep("setup"); }}
        placeholder="Nome da auditoria (ex: Catálogo Q2 2026)"
        className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-3 py-2 text-sm text-on-surface"
      />

      <div>
        <label className="text-xs text-on-surface-variant mb-1 block">Limiar de aprovação: {threshold}/10</label>
        <input type="range" min="1" max="10" value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value))} className="w-full" />
      </div>

      <div className="flex gap-1 rounded-lg bg-surface-container-low p-1 w-fit">
        <button onClick={() => setSourceTab("files")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${sourceTab === "files" ? "bg-surface-container-high text-primary" : "text-on-surface-variant"}`}>
          Upload Arquivos
        </button>
        <button onClick={() => setSourceTab("urls")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${sourceTab === "urls" ? "bg-surface-container-high text-primary" : "text-on-surface-variant"}`}>
          URLs
        </button>
      </div>

      {sourceTab === "files" ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="relative flex min-h-[120px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low/50"
        >
          <input type="file" multiple accept="image/*" onChange={(e) => e.target.files && setFiles((prev) => [...prev, ...Array.from(e.target.files!)])} className="absolute inset-0 cursor-pointer opacity-0" />
          <div className="text-center p-4">
            <p className="text-sm text-on-surface-variant">{files.length > 0 ? `${files.length} arquivos selecionados` : "Arraste ou selecione imagens"}</p>
          </div>
        </div>
      ) : (
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="Cole URLs de imagens (uma por linha)"
          rows={5}
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-3 py-2 text-sm text-on-surface font-mono"
        />
      )}

      <button
        onClick={handleStart}
        disabled={!name || !hasContent || loading}
        className="w-full rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-3 text-lg font-bold text-on-primary transition-all disabled:opacity-50"
      >
        {loading ? "Iniciando..." : "Iniciar Auditoria"}
      </button>
    </div>
  );
}
