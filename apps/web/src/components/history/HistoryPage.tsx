import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  fetchHistory,
  deleteHistoryItem,
  bulkDeleteHistory,
  bulkDownloadHistory,
  renameHistoryItem,
  type HistoryItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useHistoryFilters } from "@/hooks/useHistoryFilters";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useHistoryStore } from "@/stores/history-store";
import { HistoryFilterBar } from "./HistoryFilterBar";
import { HistoryGrid } from "./HistoryGrid";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { HistoryLightbox } from "./HistoryLightbox";
import { HistoryEmptyState } from "./HistoryEmptyState";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { RenameDialog } from "./RenameDialog";
import { SelectionToolbar } from "./SelectionToolbar";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

type HistoryPageProps = {
  onNavigateToGenerate?: (prompt: string) => void;
};

export function HistoryPage({ onNavigateToGenerate }: HistoryPageProps = {}) {
  const queryClient = useQueryClient();
  const {
    filters,
    apiParams,
    setFilter,
    toggleCategory,
    setDateRange,
    clearAll,
    activeFilterCount,
  } = useHistoryFilters();

  const {
    selectedItemId,
    panelOpen,
    lightboxOpen,
    lightboxMode,
    selectItem,
    closePanel,
    openLightbox,
    closeLightbox,
    selectionMode,
    selectedIds,
    enterSelectionMode,
    exitSelectionMode,
    toggleItem,
    selectAll,
  } = useHistoryStore();

  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [itemToDelete, setItemToDelete] = useState<HistoryItem | null>(null);
  const [itemToRename, setItemToRename] = useState<HistoryItem | null>(null);
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [isSearchPending, setIsSearchPending] = useState(false);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["history", apiParams],
    queryFn: ({ pageParam = 1 }) =>
      fetchHistory({ ...apiParams, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: string }) =>
      deleteHistoryItem(id, mode),
    onSuccess: (_data, variables) => {
      if (variables.id === selectedItemId) {
        closePanel();
      }
      setItemToDelete(null);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["history"] }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (items: { id: string; mode: string }[]) =>
      bulkDeleteHistory(items),
    onSuccess: () => {
      exitSelectionMode();
      setBulkDeletePending(false);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["history"] }),
  });

  const bulkDownloadMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDownloadHistory(ids),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "woli-pixel-images.zip";
      a.click();
      URL.revokeObjectURL(url);
      exitSelectionMode();
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, mode, displayName }: { id: string; mode: string; displayName: string | null }) =>
      renameHistoryItem(id, mode, displayName),
    onMutate: async ({ id, displayName }) => {
      await queryClient.cancelQueries({ queryKey: ["history"] });
      const snapshot = queryClient.getQueryData(["history", apiParams]);
      queryClient.setQueryData(["history", apiParams], (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: { items: HistoryItem[]; total: number; page: number; perPage: number; hasMore: boolean }) => ({
            ...page,
            items: page.items.map((item: HistoryItem) =>
              item.id === id ? { ...item, displayName } : item,
            ),
          })),
        };
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(["history", apiParams], ctx.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      setItemToRename(null);
    },
  });

  // Flatten pages into a single list
  const allItems = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  // Resolve selected item
  const selectedItem = allItems.find((i) => i.id === selectedItemId) ?? null;
  const selectedIndex = selectedItem ? allItems.indexOf(selectedItem) : -1;

  const handleBulkDelete = () => {
    const items = allItems
      .filter((i) => selectedIds.has(i.id))
      .map((i) => ({ id: i.id, mode: i.mode }));
    bulkDeleteMutation.mutate(items);
  };

  const handleBulkDownload = () => {
    bulkDownloadMutation.mutate([...selectedIds]);
  };

  const handleSelectAll = () => {
    const allIds = allItems.map((i) => i.id);
    if (selectedIds.size === allItems.length) {
      exitSelectionMode();
    } else {
      selectAll(allIds);
    }
  };

  // ── Loading skeleton ──────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 rounded-lg bg-surface-container-low animate-pulse" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-surface-container-low animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────
  if (isError) {
    return (
      <div className="space-y-4">
        <HistoryFilterBar
          filters={filters}
          activeFilterCount={activeFilterCount}
          setFilter={setFilter}
          toggleCategory={toggleCategory}
          setDateRange={setDateRange}
          clearAll={clearAll}
        />
        <HistoryEmptyState
          variant="error"
          errorMessage={error?.message ?? "Erro desconhecido"}
          onRetry={() =>
            queryClient.invalidateQueries({ queryKey: ["history"] })
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <HistoryFilterBar
            filters={filters}
            activeFilterCount={activeFilterCount}
            setFilter={setFilter}
            toggleCategory={toggleCategory}
            setDateRange={setDateRange}
            clearAll={clearAll}
            onSearchPending={setIsSearchPending}
          />
        </div>
        {allItems.length > 0 && !selectionMode && (
          <button
            type="button"
            onClick={() => enterSelectionMode()}
            className="shrink-0 rounded-lg border border-outline-variant/20 px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
          >
            Selecionar
          </button>
        )}
      </div>

      {selectionMode && (
        <SelectionToolbar
          selectedCount={selectedIds.size}
          totalCount={allItems.length}
          onCancel={exitSelectionMode}
          onSelectAll={handleSelectAll}
          onDelete={() => setBulkDeletePending(true)}
          onDownload={handleBulkDownload}
          isDeleting={bulkDeleteMutation.isPending}
          isDownloading={bulkDownloadMutation.isPending}
        />
      )}

      <div>
        <div className={cn(
          "w-full transition duration-500 ease-out",
          isSearchPending || (isFetching && !isLoading)
            ? "blur-[2px] opacity-60 scale-[0.995]"
            : "blur-0 opacity-100 scale-100",
        )}>
          {allItems.length === 0 ? (
            <HistoryEmptyState
              variant={activeFilterCount > 0 ? "no-results" : "first-use"}
              {...(activeFilterCount > 0 ? { onClearFilters: clearAll } : {})}
            />
          ) : (
            <HistoryGrid
              items={allItems}
              total={total}
              hasMore={hasNextPage ?? false}
              selectedItemId={selectedItemId}
              onSelectItem={selectItem}
              onLoadMore={fetchNextPage}
              isLoadingMore={isFetchingNextPage}
              onDeleteItem={setItemToDelete}
              onRenameItem={setItemToRename}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleItem={toggleItem}
            />
          )}
        </div>

        {/* Desktop: darkened backdrop */}
        {selectedItem && isDesktop && (
          <div
            className={cn(
              "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out",
              panelOpen ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
            onClick={closePanel}
          />
        )}

        {/* Desktop: fixed overlay panel with slide animation */}
        {selectedItem && isDesktop && (
          <div
            className={cn(
              "fixed top-0 right-0 bottom-0 w-[420px] z-50 shadow-[-8px_0_30px_-4px_rgba(0,0,0,0.12)] overflow-y-auto bg-surface",
              "transition-transform duration-300 ease-out",
              panelOpen ? "translate-x-0" : "translate-x-full",
            )}
          >
            <HistoryDetailPanel
              item={selectedItem}
              onClose={closePanel}
              onOpenLightbox={openLightbox}
              onDelete={() => setItemToDelete(selectedItem)}
              onRegenerate={() => {
                if (onNavigateToGenerate && selectedItem?.prompt) {
                  closePanel();
                  onNavigateToGenerate(selectedItem.prompt);
                }
              }}
            />
          </div>
        )}

        {/* Mobile: full-screen overlay */}
        {panelOpen && selectedItem && !isDesktop && (
          <div className="fixed inset-0 z-40 bg-black/50" onClick={closePanel}>
            <div
              className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface"
              onClick={(e) => e.stopPropagation()}
            >
              <HistoryDetailPanel
                item={selectedItem}
                onClose={closePanel}
                onOpenLightbox={openLightbox}
                onDelete={() => setItemToDelete(selectedItem)}
                onRegenerate={() => {
                  // Future: navigate to generation with pre-filled prompt
                }}
              />
            </div>
          </div>
        )}
      </div>

      {lightboxOpen && selectedItem && (
        <HistoryLightbox
          imageUrl={`${API_URL}${selectedItem.downloadUrl.replace("/api/v1", "")}`}
          alt={
            selectedItem.displayName ??
            selectedItem.imageTypeName ??
            selectedItem.originalFilename ??
            "Imagem"
          }
          mode={lightboxMode}
          originalImageUrl={
            selectedItem.mode === "upload"
              ? `${API_URL}/images/${selectedItem.id}/download`
              : undefined
          }
          onClose={closeLightbox}
          onPrev={() =>
            selectedIndex > 0 && selectItem(allItems[selectedIndex - 1]!.id)
          }
          onNext={() =>
            selectedIndex < allItems.length - 1 &&
            selectItem(allItems[selectedIndex + 1]!.id)
          }
          currentIndex={selectedIndex}
          totalItems={allItems.length}
        />
      )}

      <DeleteConfirmDialog
        open={itemToDelete !== null || bulkDeletePending}
        itemName={
          itemToDelete?.displayName ??
          itemToDelete?.imageTypeName ??
          itemToDelete?.originalFilename ??
          "Personalizado"
        }
        itemCount={bulkDeletePending ? selectedIds.size : undefined}
        onConfirm={() => {
          if (bulkDeletePending) {
            handleBulkDelete();
          } else if (itemToDelete) {
            deleteMutation.mutate({
              id: itemToDelete.id,
              mode: itemToDelete.mode,
            });
          }
        }}
        onCancel={() => {
          setItemToDelete(null);
          setBulkDeletePending(false);
        }}
        isDeleting={
          bulkDeletePending
            ? bulkDeleteMutation.isPending
            : deleteMutation.isPending
        }
      />

      <RenameDialog
        open={itemToRename !== null}
        currentName={
          itemToRename?.displayName ??
          itemToRename?.imageTypeName ??
          itemToRename?.originalFilename ??
          "Personalizado"
        }
        onConfirm={(newName) => {
          if (itemToRename) {
            renameMutation.mutate({
              id: itemToRename.id,
              mode: itemToRename.mode,
              displayName: newName,
            });
          }
        }}
        onCancel={() => setItemToRename(null)}
        isSaving={renameMutation.isPending}
      />
    </div>
  );
}
