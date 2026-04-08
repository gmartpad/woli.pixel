import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthImage } from "@/hooks/useAuthImage";
import { downloadAuthFile } from "@/lib/auth-download";
import { useDownload } from "@/hooks/useDownload";
import type { HistoryItem } from "@/lib/api";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

type Props = {
  item: HistoryItem;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: (item: HistoryItem) => void;
  onRename?: (item: HistoryItem) => void;
  selectionMode?: boolean;
  isChecked?: boolean;
  onToggle?: (id: string) => void;
};

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryCard({
  item, isSelected, onClick, onDelete, onRename,
  selectionMode = false, isChecked = false, onToggle,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { downloading, trigger: triggerDownload } = useDownload();

  const title =
    item.displayName || item.imageTypeName || item.originalFilename || "Personalizado";

  const meta = [
    item.finalWidth && item.finalHeight
      ? `${item.finalWidth}×${item.finalHeight}`
      : null,
    item.finalFormat,
    item.finalSizeKb ? `${item.finalSizeKb}KB` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const thumbnailUrl = `${API_URL}${item.thumbnailUrl.replace("/api/v1", "")}`;
  const downloadHref = `${API_URL}${item.downloadUrl.replace("/api/v1", "")}`;
  const { src: thumbnailSrc, loading: thumbLoading } = useAuthImage(thumbnailUrl);

  return (
    <button
      type="button"
      onClick={selectionMode && onToggle ? () => onToggle(item.id) : onClick}
      className={cn(
        "group relative block w-full rounded-xl border-2 text-left transition-all",
        isSelected || isChecked
          ? "border-primary shadow-xl shadow-primary/5"
          : "border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high",
      )}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-square overflow-hidden rounded-t-[10px] bg-surface-container">
        {imgError || (!thumbLoading && !thumbnailSrc) ? (
          <div className="flex h-full w-full items-center justify-center text-on-surface-variant/70">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              <line x1="3" y1="3" x2="21" y2="21" />
            </svg>
          </div>
        ) : thumbLoading ? (
          <div className="h-full w-full animate-pulse bg-surface-container-high" />
        ) : (
          <img
            src={thumbnailSrc!}
            alt={title}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        )}

        {/* Status badge OR selection checkbox */}
        {selectionMode ? (
          <span
            data-testid="selection-checkbox"
            className={cn(
              "absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
              isChecked
                ? "border-primary bg-primary text-on-primary"
                : "border-on-surface-variant/40 bg-surface/80",
            )}
          >
            {isChecked && (
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
        ) : (
          <span
            data-testid="status-badge"
            className={cn(
              "absolute top-2 left-2 h-2.5 w-2.5 rounded-full",
              item.status === "completed" ? "bg-emerald-400" : "bg-red-400",
            )}
          />
        )}

        {/* Mode badge (top-right) */}
        <span
          className={cn(
            "absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur-sm shadow-sm",
            item.mode === "generation"
              ? "bg-surface/80 text-primary"
              : item.mode === "crop"
                ? "bg-surface/80 text-secondary"
                : "bg-surface/80 text-tertiary",
          )}
        >
          {item.mode === "generation" ? "Geração" : item.mode === "crop" ? "Recorte" : "Upload"}
        </span>
      </div>

      {/* Text content */}
      <div className="flex flex-col gap-0.5 p-3">
        <div className="flex items-start gap-1">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">
            {title}
          </span>
          {(onDelete || onRename) && !selectionMode && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                aria-label="Ações"
                className="flex h-6 w-6 items-center justify-center rounded-md text-on-surface-variant/60 transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:bg-surface-container-high focus-visible:text-on-surface"
              >
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  {/* Backdrop to close menu on outside click */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                    }}
                  />

                  {/* Dropdown menu */}
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border border-outline-variant/20 bg-surface py-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      disabled={downloading}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        const name = item.displayName || item.originalFilename || `${item.mode}-${item.id.slice(0, 8)}`;
                        const ext = item.finalFormat || "png";
                        triggerDownload(() => downloadAuthFile(downloadHref, `${name}.${ext}`));
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-60"
                    >
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
                    </button>
                    {onRename && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onRename(item);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high"
                      >
                        <svg
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                        Renomear
                      </button>
                    )}
                    {onDelete && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onDelete(item);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error-container/20"
                    >
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                      Excluir
                    </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {meta && (
          <span className="truncate text-xs text-on-surface-variant">
            {meta}
          </span>
        )}
        <span className="text-xs text-on-surface-variant">
          {formatTime(item.createdAt)}
        </span>
      </div>
    </button>
  );
}
