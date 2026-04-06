import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCustomPresets, createCustomPreset, deleteCustomPreset } from "@/lib/api";
import type { CustomPreset } from "@/lib/api";

type Props = {
  width: number | null;
  height: number | null;
  onSelectPreset: (preset: CustomPreset) => void;
  selectedPresetId?: string | null;
};

export function CustomPresetManager({ width, height, onSelectPreset, selectedPresetId }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [presetName, setPresetName] = useState("");

  const { data: presets } = useQuery({
    queryKey: ["custom-presets"],
    queryFn: fetchCustomPresets,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: createCustomPreset,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-presets"] });
    },
    onSuccess: () => {
      setShowForm(false);
      setPresetName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomPreset,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-presets"] });
    },
  });

  const canSave = width !== null && height !== null;

  const handleSave = () => {
    if (!presetName.trim() || !width || !height) return;
    createMutation.mutate({ name: presetName.trim(), width, height });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-on-surface">Presets Salvos</h4>
        {canSave && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            Salvar como Preset
          </button>
        )}
      </div>

      {/* Save form */}
      {showForm && canSave && (
        <div className="flex gap-2">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Nome do preset"
            className="flex-1 rounded-lg bg-surface-container-low border border-outline-variant/20 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={createMutation.isPending || !presetName.trim()}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setPresetName("");
            }}
            className="rounded-lg px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Preset grid */}
      {presets && presets.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {presets.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`group relative flex flex-col gap-1 rounded-xl border-2 p-3 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant/20 bg-surface-container-low hover:border-outline-variant/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-on-surface">{preset.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(preset.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        deleteMutation.mutate(preset.id);
                      }
                    }}
                    className="rounded p-0.5 text-outline opacity-0 hover:text-red-400 group-hover:opacity-100 transition-opacity"
                    aria-label={`Excluir ${preset.name}`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                </div>
                <span className="text-xs font-mono text-on-surface-variant">
                  {preset.width} x {preset.height}
                </span>
                <span className="inline-flex w-fit rounded-md bg-surface-container-high px-1.5 py-0.5 text-[10px] text-on-surface-variant">
                  {preset.style}
                </span>
              </button>
            );
          })}
        </div>
      ) : presets && presets.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-4">Nenhum preset salvo</p>
      ) : null}
    </div>
  );
}
