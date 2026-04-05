import { useAppStore } from "@/stores/app-store";

export function ErrorBanner() {
  const { error, setError, reset } = useAppStore();

  if (!error) return null;

  return (
    <div role="alert" aria-live="polite" className="flex items-center justify-between rounded-xl border border-error/30 bg-error-container/15 px-4 py-3 backdrop-blur-sm shadow-[0_0_15px_rgba(255,113,108,0.08)]">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-error" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </svg>
        <span className="text-sm text-on-error-container">{error}</span>
      </div>
      <button
        onClick={() => { setError(null); reset(); }}
        className="text-xs text-error hover:text-error-dim underline"
      >
        Tentar novamente
      </button>
    </div>
  );
}
