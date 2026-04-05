import { useState, useEffect } from "react";
import { useBrandStore, type BrandProfile } from "@/stores/brand-store";
import { getBrands, createBrand, updateBrand, deleteBrand, setDefaultBrand } from "@/lib/api";

export function BrandProfileManager() {
  const { profiles, setProfiles } = useBrandStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", primary_color: "#000000", secondary_color: "", accent_color: "", neutral_color: "", tolerance: 25, forbidden_colors: "" as string, notes: "" });

  useEffect(() => {
    getBrands().then(setProfiles).catch(console.error);
  }, [setProfiles]);

  const resetForm = () => {
    setForm({ name: "", primary_color: "#000000", secondary_color: "", accent_color: "", neutral_color: "", tolerance: 25, forbidden_colors: "", notes: "" });
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    const data = {
      name: form.name,
      primary_color: form.primary_color,
      secondary_color: form.secondary_color || undefined,
      accent_color: form.accent_color || undefined,
      neutral_color: form.neutral_color || undefined,
      tolerance: form.tolerance,
      forbidden_colors: form.forbidden_colors ? form.forbidden_colors.split(",").map((s) => s.trim()) : undefined,
      notes: form.notes || undefined,
    };

    if (editId) {
      await updateBrand(editId, data);
    } else {
      await createBrand(data);
    }
    const updated = await getBrands();
    setProfiles(updated);
    resetForm();
  };

  const handleEdit = (p: BrandProfile) => {
    setForm({
      name: p.name,
      primary_color: p.primaryColor,
      secondary_color: p.secondaryColor || "",
      accent_color: p.accentColor || "",
      neutral_color: p.neutralColor || "",
      tolerance: p.tolerance,
      forbidden_colors: p.forbiddenColors?.join(", ") || "",
      notes: p.notes || "",
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await deleteBrand(id);
    const updated = await getBrands();
    setProfiles(updated);
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultBrand(id);
    const updated = await getBrands();
    setProfiles(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold font-headline text-on-surface">Perfis de Marca</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors">
          Criar Perfil
        </button>
      </div>

      {showForm && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h4 className="font-semibold text-on-surface">{editId ? "Editar" : "Novo"} Perfil</h4>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da marca" className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-3 py-2 text-sm text-on-surface" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["primary_color", "secondary_color", "accent_color", "neutral_color"] as const).map((key) => (
              <div key={key}>
                <label className="text-xs text-on-surface-variant mb-1 block">{key.replace("_", " ").replace("color", "").trim()}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form[key] || "#000000"} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="h-8 w-8 rounded cursor-pointer" />
                  <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="flex-1 rounded bg-surface-container-low border border-outline-variant/20 px-2 py-1 text-xs text-on-surface font-mono" placeholder="#RRGGBB" />
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">Tolerância (ΔE): {form.tolerance}</label>
            <input type="range" min="0" max="100" value={form.tolerance} onChange={(e) => setForm({ ...form, tolerance: parseInt(e.target.value) })} className="w-full" />
          </div>
          <input value={form.forbidden_colors} onChange={(e) => setForm({ ...form, forbidden_colors: e.target.value })} placeholder="Cores proibidas (hex separado por vírgula)" className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-3 py-2 text-sm text-on-surface" />
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas sobre o guia de marca..." rows={2} className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-3 py-2 text-sm text-on-surface" />
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={!form.name || !form.primary_color} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50">
              {editId ? "Salvar" : "Criar"}
            </button>
            <button onClick={resetForm} className="rounded-lg bg-surface-container-high px-4 py-2 text-sm text-on-surface-variant">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {profiles.map((p) => (
          <div key={p.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <div className="h-6 w-6 rounded-full border border-outline-variant/30" style={{ backgroundColor: p.primaryColor }} />
                {p.secondaryColor && <div className="h-6 w-6 rounded-full border border-outline-variant/30" style={{ backgroundColor: p.secondaryColor }} />}
                {p.accentColor && <div className="h-6 w-6 rounded-full border border-outline-variant/30" style={{ backgroundColor: p.accentColor }} />}
              </div>
              <div>
                <span className="font-medium text-on-surface">{p.name}</span>
                {p.isDefault && <span className="ml-2 text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Padrão</span>}
              </div>
            </div>
            <div className="flex gap-1">
              {!p.isDefault && (
                <button onClick={() => handleSetDefault(p.id)} className="rounded-lg px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high">Definir Padrão</button>
              )}
              <button onClick={() => handleEdit(p)} className="rounded-lg px-2 py-1 text-xs text-primary hover:bg-primary/10">Editar</button>
              <button onClick={() => handleDelete(p.id)} className="rounded-lg px-2 py-1 text-xs text-error hover:bg-error/10">Excluir</button>
            </div>
          </div>
        ))}
        {profiles.length === 0 && !showForm && (
          <p className="text-sm text-on-surface-variant text-center py-8">Nenhum perfil de marca configurado.</p>
        )}
      </div>
    </div>
  );
}
