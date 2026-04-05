import { useState, useEffect } from "react";
import { useGateStore, type QualityGateConfig } from "@/stores/gate-store";
import { getGateConfigs, createGateConfig, updateGateConfig, deleteGateConfig } from "@/lib/api";

export function GateConfigManager() {
  const { configs, setConfigs, setSelectedConfig } = useGateStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    min_quality_score: 6,
    require_no_blur: true,
    require_no_low_resolution: true,
    require_min_width: "",
    require_min_height: "",
    max_file_size_kb: "",
    allowed_content_types: [] as string[],
    blocked_content_types: [] as string[],
  });

  useEffect(() => {
    getGateConfigs().then(setConfigs).catch(console.error);
  }, [setConfigs]);

  const contentTypes = ["photo", "logo", "icon", "screenshot", "illustration", "banner", "other"];

  const resetForm = () => {
    setForm({ name: "", min_quality_score: 6, require_no_blur: true, require_no_low_resolution: true, require_min_width: "", require_min_height: "", max_file_size_kb: "", allowed_content_types: [], blocked_content_types: [] });
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    const data = {
      name: form.name,
      min_quality_score: form.min_quality_score,
      require_no_blur: form.require_no_blur,
      require_no_low_resolution: form.require_no_low_resolution,
      require_min_width: form.require_min_width ? parseInt(form.require_min_width) : null,
      require_min_height: form.require_min_height ? parseInt(form.require_min_height) : null,
      max_file_size_kb: form.max_file_size_kb ? parseInt(form.max_file_size_kb) : null,
      allowed_content_types: form.allowed_content_types.length > 0 ? form.allowed_content_types : null,
      blocked_content_types: form.blocked_content_types.length > 0 ? form.blocked_content_types : null,
      generate_secret: !editId,
    };

    if (editId) await updateGateConfig(editId, data);
    else await createGateConfig(data);

    const updated = await getGateConfigs();
    setConfigs(updated);
    resetForm();
  };

  const handleEdit = (c: QualityGateConfig) => {
    setForm({
      name: c.name,
      min_quality_score: c.minQualityScore,
      require_no_blur: c.requireNoBlur,
      require_no_low_resolution: c.requireNoLowResolution,
      require_min_width: c.requireMinWidth?.toString() || "",
      require_min_height: c.requireMinHeight?.toString() || "",
      max_file_size_kb: c.maxFileSizeKb?.toString() || "",
      allowed_content_types: c.allowedContentTypes || [],
      blocked_content_types: c.blockedContentTypes || [],
    });
    setEditId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await deleteGateConfig(id);
    setConfigs(await getGateConfigs());
  };

  const toggleType = (list: "allowed_content_types" | "blocked_content_types", type: string) => {
    setForm((f) => ({
      ...f,
      [list]: f[list].includes(type) ? f[list].filter((t) => t !== type) : [...f[list], type],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold font-headline text-on-surface">Quality Gates</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors">
          Criar Gate
        </button>
      </div>

      {showForm && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h4 className="font-semibold text-on-surface">{editId ? "Editar" : "Novo"} Quality Gate</h4>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do gate" className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-3 py-2 text-sm text-on-surface" />

          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Score mínimo: {form.min_quality_score}</label>
            <input type="range" min="1" max="10" value={form.min_quality_score} onChange={(e) => setForm({ ...form, min_quality_score: parseInt(e.target.value) })} className="w-full" />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input type="checkbox" checked={form.require_no_blur} onChange={(e) => setForm({ ...form, require_no_blur: e.target.checked })} className="rounded" />
              Sem blur
            </label>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input type="checkbox" checked={form.require_no_low_resolution} onChange={(e) => setForm({ ...form, require_no_low_resolution: e.target.checked })} className="rounded" />
              Sem baixa resolução
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-on-surface-variant block mb-1">Largura mín (px)</label>
              <input value={form.require_min_width} onChange={(e) => setForm({ ...form, require_min_width: e.target.value })} type="number" className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-2 py-1.5 text-sm text-on-surface" />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant block mb-1">Altura mín (px)</label>
              <input value={form.require_min_height} onChange={(e) => setForm({ ...form, require_min_height: e.target.value })} type="number" className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-2 py-1.5 text-sm text-on-surface" />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant block mb-1">Tam máx (KB)</label>
              <input value={form.max_file_size_kb} onChange={(e) => setForm({ ...form, max_file_size_kb: e.target.value })} type="number" className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-2 py-1.5 text-sm text-on-surface" />
            </div>
          </div>

          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Tipos permitidos</label>
            <div className="flex flex-wrap gap-1">
              {contentTypes.map((t) => (
                <button key={t} onClick={() => toggleType("allowed_content_types", t)} className={`rounded-full px-2 py-0.5 text-xs ${form.allowed_content_types.includes(t) ? "bg-emerald-500/20 text-emerald-400" : "bg-surface-container-high text-on-surface-variant"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={!form.name} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50">{editId ? "Salvar" : "Criar"}</button>
            <button onClick={resetForm} className="rounded-lg bg-surface-container-high px-4 py-2 text-sm text-on-surface-variant">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {configs.map((c) => (
          <div key={c.id} className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-on-surface">{c.name}</span>
                <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${c.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-surface-container-high text-outline"}`}>
                  {c.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setSelectedConfig(c.id); }} className="rounded-lg px-2 py-1 text-xs text-primary hover:bg-primary/10">Testar</button>
                <button onClick={() => handleEdit(c)} className="rounded-lg px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high">Editar</button>
                <button onClick={() => handleDelete(c.id)} className="rounded-lg px-2 py-1 text-xs text-error hover:bg-error/10">Excluir</button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-on-surface-variant">
              <span className="bg-surface-container-high rounded px-1.5 py-0.5">Score ≥ {c.minQualityScore}</span>
              {c.requireNoBlur && <span className="bg-surface-container-high rounded px-1.5 py-0.5">Sem blur</span>}
              {c.requireNoLowResolution && <span className="bg-surface-container-high rounded px-1.5 py-0.5">Alta res</span>}
              {c.requireMinWidth && <span className="bg-surface-container-high rounded px-1.5 py-0.5">≥{c.requireMinWidth}px</span>}
              {c.webhookSecret && <span className="bg-surface-container-high rounded px-1.5 py-0.5">Webhook ativo</span>}
            </div>
          </div>
        ))}
        {configs.length === 0 && !showForm && (
          <p className="text-sm text-on-surface-variant text-center py-8">Nenhum quality gate configurado.</p>
        )}
      </div>
    </div>
  );
}
