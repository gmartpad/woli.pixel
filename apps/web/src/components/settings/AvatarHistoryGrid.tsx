import { useState } from "react";
import { AvatarThumbnail } from "./AvatarThumbnail";

interface AvatarHistoryEntry {
  id: string;
  url: string;
  uploadedAt: string;
  fileSize: number;
}

interface AvatarHistoryGridProps {
  avatars: AvatarHistoryEntry[];
  currentAvatarId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  isLoading: boolean;
}

export function AvatarHistoryGrid({
  avatars,
  currentAvatarId,
  onSelect,
  onDelete,
  onBulkDelete,
  isLoading,
}: AvatarHistoryGridProps) {
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [singleSelectedId, setSingleSelectedId] = useState<string | null>(null);

  function handleSelect(id: string) {
    if (isMultiSelect) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSingleSelectedId(id);
      onSelect(id);
    }
  }

  function handleToggleMultiSelect() {
    setIsMultiSelect((prev) => !prev);
    setSelectedIds(new Set());
  }

  function handleBulkDelete() {
    if (selectedIds.size > 0) {
      onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsMultiSelect(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 p-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 w-16 animate-pulse rounded-full bg-surface-container-high"
          />
        ))}
      </div>
    );
  }

  if (avatars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm text-outline">
          Nenhuma foto no historico. Envie sua primeira foto!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
        {avatars.map((avatar) => (
          <div key={avatar.id} className="flex justify-center">
            <AvatarThumbnail
              id={avatar.id}
              url={avatar.url}
              isCurrent={avatar.id === currentAvatarId}
              isSelected={
                isMultiSelect
                  ? selectedIds.has(avatar.id)
                  : singleSelectedId === avatar.id
              }
              isMultiSelect={isMultiSelect}
              onSelect={handleSelect}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-outline-variant/20 pt-3">
        {isMultiSelect ? (
          <>
            <button
              type="button"
              onClick={handleToggleMultiSelect}
              className="text-xs text-outline hover:text-on-surface transition-colors"
            >
              Cancelar seleção
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="text-xs font-medium text-error hover:text-error/80 disabled:opacity-50 transition-colors"
            >
              Excluir selecionados ({selectedIds.size})
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-outline">{avatars.length} fotos</span>
            <button
              type="button"
              onClick={handleToggleMultiSelect}
              className="flex items-center gap-1.5 rounded-full border border-outline-variant/40 px-3 py-1 text-xs text-outline hover:border-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Selecionar vários
            </button>
          </>
        )}
      </div>
    </div>
  );
}
