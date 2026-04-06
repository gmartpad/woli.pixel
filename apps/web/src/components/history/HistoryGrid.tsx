import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { HistoryCard } from "./HistoryCard";
import type { HistoryItem } from "@/lib/api";

type Props = {
  items: HistoryItem[];
  total: number;
  hasMore: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  onDeleteItem?: (item: HistoryItem) => void;
  onRenameItem?: (item: HistoryItem) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleItem?: (id: string) => void;
};

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (itemDate.getTime() === today.getTime()) {
    return `Hoje — ${date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`;
  }
  if (itemDate.getTime() === yesterday.getTime()) {
    return `Ontem — ${date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`;
  }
  const diffDays = Math.floor(
    (today.getTime() - itemDate.getTime()) / 86400000,
  );
  if (diffDays > 30) {
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function groupByDate(items: HistoryItem[]): Map<string, HistoryItem[]> {
  const groups = new Map<string, HistoryItem[]>();
  for (const item of items) {
    const key = formatDateGroup(item.createdAt);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

export function HistoryGrid({
  items,
  total,
  hasMore,
  selectedItemId,
  onSelectItem,
  onLoadMore,
  isLoadingMore,
  onDeleteItem,
  onRenameItem,
  selectionMode = false,
  selectedIds,
  onToggleItem,
}: Props) {
  const groups = groupByDate(items);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {Array.from(groups.entries()).map(([label, groupItems], index) => {
        const isExpanded = !collapsedGroups.has(label);
        return (
          <section key={label}>
            <button
              type="button"
              onClick={() => toggleGroup(label)}
              aria-expanded={isExpanded}
              aria-controls={`history-group-${index}`}
              className="sticky top-0 z-10 flex w-full items-center gap-2 bg-surface/80 backdrop-blur-sm py-2 text-sm font-medium text-on-surface-variant border-b border-outline-variant/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "transition-transform duration-200",
                  isExpanded && "rotate-90",
                )}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>{label}</span>
              <span className="text-xs text-on-surface-variant/80">
                ({groupItems.length})
              </span>
              <div className="h-px flex-1 bg-outline-variant/30" />
            </button>
            <section
              id={`history-group-${index}`}
              className="grid transition-[grid-template-rows] duration-200"
              style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
            >
              <div className={cn("min-h-0", isExpanded ? "overflow-visible" : "overflow-hidden")}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 mt-3">
                  {groupItems.map((item) => (
                    <HistoryCard
                      key={item.id}
                      item={item}
                      isSelected={item.id === selectedItemId}
                      onClick={() => onSelectItem(item.id)}
                      onDelete={onDeleteItem}
                      onRename={onRenameItem}
                      selectionMode={selectionMode}
                      isChecked={selectedIds?.has(item.id) ?? false}
                      onToggle={onToggleItem}
                    />
                  ))}
                </div>
              </div>
            </section>
          </section>
        );
      })}

      {/* Load More footer */}
      <div className="flex flex-col items-center gap-3 py-4">
        <span className="text-sm text-on-surface-variant">
          Mostrando {items.length} de {total} imagens
        </span>
        {hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-lg bg-surface-container-low border border-outline-variant/20 px-6 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? "Carregando..." : "Carregar Mais"}
          </button>
        )}
      </div>
    </div>
  );
}
