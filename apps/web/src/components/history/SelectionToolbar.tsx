const btnBase =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

type Props = {
  selectedCount: number;
  totalCount: number;
  onCancel: () => void;
  onSelectAll: () => void;
  onDelete: () => void;
  onDownload: () => void;
  isDeleting: boolean;
  isDownloading: boolean;
};

export function SelectionToolbar({
  selectedCount,
  totalCount,
  onCancel,
  onSelectAll,
  onDelete,
  onDownload,
  isDeleting,
  isDownloading,
}: Props) {
  const allSelected = selectedCount === totalCount;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-fit -translate-x-1/2 items-center gap-1.5 rounded-xl border border-outline-variant/20 bg-surface px-2 py-2 shadow-2xl sm:gap-2 sm:px-3">
      {/* Close */}
      <button
        type="button"
        onClick={onCancel}
        aria-label="Sair da seleção"
        className={`${btnBase} bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high !px-2`}
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Count */}
      <span className="px-1 text-sm font-medium text-on-surface whitespace-nowrap">
        {selectedCount} <span className="hidden sm:inline">selecionados</span>
      </span>

      {/* Divider */}
      <div className="h-6 w-px shrink-0 bg-outline-variant/30" />

      {/* Select all / Deselect all */}
      <button
        type="button"
        onClick={onSelectAll}
        className={`${btnBase} bg-surface-container-low text-primary hover:bg-primary/10`}
      >
        {allSelected ? (
          <>
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            <span className="hidden sm:inline">Desmarcar todos</span>
          </>
        ) : (
          <>
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span className="hidden sm:inline">Selecionar todos</span>
          </>
        )}
      </button>

      {/* Divider */}
      <div className="h-6 w-px shrink-0 bg-outline-variant/30" />

      {/* Download */}
      <button
        type="button"
        onClick={onDownload}
        disabled={isDownloading}
        className={`${btnBase} bg-surface-container-low text-on-surface hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="hidden sm:inline">{isDownloading ? "Baixando..." : "Baixar"}</span>
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className={`${btnBase} bg-error-container/20 text-error hover:bg-error-container/40 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
        <span className="hidden sm:inline">{isDeleting ? "Excluindo..." : "Excluir"}</span>
      </button>
    </div>
  );
}
