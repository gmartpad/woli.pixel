import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore } from "./history-store";

describe("useHistoryStore", () => {
  beforeEach(() => {
    useHistoryStore.setState({
      selectedItemId: null,
      panelOpen: false,
      lightboxOpen: false,
      lightboxMode: "single",
      selectionMode: false,
      selectedIds: new Set(),
    });
  });

  it("starts with panel closed and no selection", () => {
    const state = useHistoryStore.getState();
    expect(state.selectedItemId).toBeNull();
    expect(state.panelOpen).toBe(false);
    expect(state.lightboxOpen).toBe(false);
    expect(state.lightboxMode).toBe("single");
  });

  it("selectItem opens panel and sets id", () => {
    useHistoryStore.getState().selectItem("item-42");

    const state = useHistoryStore.getState();
    expect(state.selectedItemId).toBe("item-42");
    expect(state.panelOpen).toBe(true);
  });

  it("closePanel resets selection and closes panel", () => {
    useHistoryStore.getState().selectItem("item-42");
    useHistoryStore.getState().closePanel();

    const state = useHistoryStore.getState();
    expect(state.selectedItemId).toBeNull();
    expect(state.panelOpen).toBe(false);
  });

  it("openLightbox sets mode and opens lightbox", () => {
    useHistoryStore.getState().openLightbox("compare");

    const state = useHistoryStore.getState();
    expect(state.lightboxOpen).toBe(true);
    expect(state.lightboxMode).toBe("compare");
  });

  it("openLightbox with single mode", () => {
    useHistoryStore.getState().openLightbox("single");

    const state = useHistoryStore.getState();
    expect(state.lightboxOpen).toBe(true);
    expect(state.lightboxMode).toBe("single");
  });

  it("closeLightbox keeps panel open (only closes lightbox)", () => {
    useHistoryStore.getState().selectItem("item-42");
    useHistoryStore.getState().openLightbox("compare");
    useHistoryStore.getState().closeLightbox();

    const state = useHistoryStore.getState();
    expect(state.lightboxOpen).toBe(false);
    expect(state.panelOpen).toBe(true);
    expect(state.selectedItemId).toBe("item-42");
  });
});

describe("history-store selection", () => {
  beforeEach(() => {
    useHistoryStore.setState({
      selectedItemId: null,
      panelOpen: false,
      lightboxOpen: false,
      lightboxMode: "single",
      selectionMode: false,
      selectedIds: new Set(),
    });
  });

  it("enterSelectionMode activates selection mode", () => {
    useHistoryStore.getState().enterSelectionMode();
    expect(useHistoryStore.getState().selectionMode).toBe(true);
  });

  it("enterSelectionMode with firstId pre-selects that item", () => {
    useHistoryStore.getState().enterSelectionMode("item-1");
    expect(useHistoryStore.getState().selectionMode).toBe(true);
    expect(useHistoryStore.getState().selectedIds.has("item-1")).toBe(true);
  });

  it("enterSelectionMode closes the detail panel", () => {
    useHistoryStore.setState({ selectedItemId: "x", panelOpen: true });
    useHistoryStore.getState().enterSelectionMode();
    expect(useHistoryStore.getState().panelOpen).toBe(false);
    expect(useHistoryStore.getState().selectedItemId).toBeNull();
  });

  it("exitSelectionMode clears selection and deactivates", () => {
    useHistoryStore.setState({ selectionMode: true, selectedIds: new Set(["a", "b"]) });
    useHistoryStore.getState().exitSelectionMode();
    expect(useHistoryStore.getState().selectionMode).toBe(false);
    expect(useHistoryStore.getState().selectedIds.size).toBe(0);
  });

  it("toggleItem adds and removes items", () => {
    useHistoryStore.setState({ selectionMode: true, selectedIds: new Set() });
    useHistoryStore.getState().toggleItem("item-1");
    expect(useHistoryStore.getState().selectedIds.has("item-1")).toBe(true);
    useHistoryStore.getState().toggleItem("item-1");
    expect(useHistoryStore.getState().selectedIds.has("item-1")).toBe(false);
  });

  it("toggleItem does NOT exit selection mode when last item is deselected", () => {
    useHistoryStore.setState({ selectionMode: true, selectedIds: new Set(["item-1"]) });
    useHistoryStore.getState().toggleItem("item-1");
    expect(useHistoryStore.getState().selectionMode).toBe(true);
    expect(useHistoryStore.getState().selectedIds.size).toBe(0);
  });

  it("selectAll sets all provided ids", () => {
    useHistoryStore.setState({ selectionMode: true, selectedIds: new Set() });
    useHistoryStore.getState().selectAll(["a", "b", "c"]);
    expect(useHistoryStore.getState().selectedIds).toEqual(new Set(["a", "b", "c"]));
  });

  it("selectItem closes selection mode and opens panel", () => {
    useHistoryStore.setState({ selectionMode: true, selectedIds: new Set(["a"]) });
    useHistoryStore.getState().selectItem("x");
    expect(useHistoryStore.getState().selectionMode).toBe(false);
    expect(useHistoryStore.getState().selectedIds.size).toBe(0);
    expect(useHistoryStore.getState().panelOpen).toBe(true);
  });
});
