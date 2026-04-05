import { useEffect } from "react";
import { useBrandStore } from "@/stores/brand-store";
import { getBrands } from "@/lib/api";

export function BrandSelector() {
  const { profiles, activeProfileId, setProfiles, setActiveProfile } = useBrandStore();

  useEffect(() => {
    getBrands().then(setProfiles).catch(() => {});
  }, [setProfiles]);

  if (profiles.length === 0) return null;

  return (
    <div className="px-2 pb-2">
      <select
        value={activeProfileId || ""}
        onChange={(e) => setActiveProfile(e.target.value || null)}
        className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-2 py-1.5 text-xs text-on-surface-variant"
      >
        <option value="">Sem marca</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {p.isDefault ? "(padrão)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
