import { cn } from "@/lib/utils";

type Props =
  | { variant: "first-use" }
  | { variant: "no-results"; onClearFilters: () => void }
  | { variant: "error"; errorMessage: string; onRetry: () => void };

export function HistoryEmptyState(props: Props) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      {props.variant === "first-use" && <FirstUseContent />}
      {props.variant === "no-results" && (
        <NoResultsContent onClearFilters={props.onClearFilters} />
      )}
      {props.variant === "error" && (
        <ErrorContent
          errorMessage={props.errorMessage}
          onRetry={props.onRetry}
        />
      )}
    </div>
  );
}

function FirstUseContent() {
  return (
    <>
      {/* Image/photo outline icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-16 w-16 text-on-surface-variant"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Zm14.25-12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
        />
      </svg>
      <h2 className="mt-4 text-lg font-semibold text-on-surface">
        Nenhuma imagem no histórico
      </h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Gere ou processe sua primeira imagem para vê-la aqui.
      </p>
      <a
        href="/"
        className={cn(
          "mt-6 inline-flex items-center rounded-lg bg-primary px-6 py-2.5",
          "text-sm font-medium text-on-primary",
          "hover:bg-primary/90 transition-colors",
        )}
      >
        Gerar Imagem
      </a>
    </>
  );
}

function NoResultsContent({
  onClearFilters,
}: {
  onClearFilters: () => void;
}) {
  return (
    <>
      {/* Search icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-16 w-16 text-on-surface-variant"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>
      <h2 className="mt-4 text-lg font-semibold text-on-surface">
        Nenhum resultado encontrado
      </h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Tente ajustar seus filtros ou limpar a busca.
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className={cn(
          "mt-6 inline-flex items-center rounded-lg bg-primary px-6 py-2.5",
          "text-sm font-medium text-on-primary",
          "hover:bg-primary/90 transition-colors",
        )}
      >
        Limpar Filtros
      </button>
    </>
  );
}

function ErrorContent({
  errorMessage,
  onRetry,
}: {
  errorMessage: string;
  onRetry: () => void;
}) {
  return (
    <>
      {/* Error icon (red) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-16 w-16 text-red-400"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      <h2 className="mt-4 text-lg font-semibold text-on-surface">
        Erro ao carregar histórico
      </h2>
      <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "mt-6 inline-flex items-center rounded-lg bg-primary px-6 py-2.5",
          "text-sm font-medium text-on-primary",
          "hover:bg-primary/90 transition-colors",
        )}
      >
        Tentar Novamente
      </button>
    </>
  );
}
