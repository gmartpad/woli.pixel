import { create } from "zustand";

export type LightboxMode = "single" | "compare";

type HistoryUIState = {
  selectedItemId: string | null;
  panelOpen: boolean;
  lightboxOpen: boolean;
  lightboxMode: LightboxMode;
  selectionMode: boolean;
  selectedIds: Set<string>;
  selectItem: (id: string) => void;
  closePanel: () => void;
  openLightbox: (mode: LightboxMode) => void;
  closeLightbox: () => void;
  enterSelectionMode: (firstId?: string) => void;
  exitSelectionMode: () => void;
  toggleItem: (id: string) => void;
  selectAll: (ids: string[]) => void;
};

export const useHistoryStore = create<HistoryUIState>((set) => ({
  selectedItemId: null,
  panelOpen: false,
  lightboxOpen: false,
  lightboxMode: "single",
  selectionMode: false,
  selectedIds: new Set(),
  selectItem: (id) =>
    set({ selectedItemId: id, panelOpen: true, selectionMode: false, selectedIds: new Set() }),
  closePanel: () => set({ selectedItemId: null, panelOpen: false }),
  openLightbox: (mode) => set({ lightboxOpen: true, lightboxMode: mode }),
  closeLightbox: () => set({ lightboxOpen: false }),
  enterSelectionMode: (firstId) =>
    set({
      selectionMode: true,
      selectedIds: firstId ? new Set([firstId]) : new Set(),
      selectedItemId: null,
      panelOpen: false,
    }),
  exitSelectionMode: () =>
    set({ selectionMode: false, selectedIds: new Set() }),
  toggleItem: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: (ids) =>
    set({ selectedIds: new Set(ids) }),
}));
