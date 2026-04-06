import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  itemName: string;
  itemCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
};

export function DeleteConfirmDialog({
  open,
  itemName,
  itemCount,
  onConfirm,
  onCancel,
  isDeleting,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onCancel]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="m-auto backdrop:bg-black/50 rounded-xl border border-outline-variant/20 bg-surface p-0 shadow-2xl"
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-on-surface">
              {itemCount && itemCount > 1 ? (
                <>
                  Tem certeza que deseja excluir{" "}
                  <strong className="font-semibold">{itemCount} imagens</strong>?
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir{" "}
                  <strong className="font-semibold">{itemName}</strong>?
                </>
              )}
            </p>
            <p className="text-xs text-on-surface-variant">
              Esta ação não pode ser desfeita.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-bright"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="rounded-lg bg-error-container/20 px-4 py-2 text-sm font-medium text-error hover:bg-error-container/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
