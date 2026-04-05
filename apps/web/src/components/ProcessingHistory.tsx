import { useAppStore } from "@/stores/app-store";

export function ProcessingHistory() {
  const { history } = useAppStore();

  if (history.length === 0) return null;

  return (
    <div className="mt-8 border-t border-outline-variant/10 pt-6">
      <h3 className="mb-4 text-2xl font-bold font-headline text-on-surface">
        Histórico Recente
        <span className="ml-2 text-sm font-normal text-on-surface-variant">
          ({history.length} {history.length === 1 ? "imagem" : "imagens"})
        </span>
      </h3>

      <div className="glass-card overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <caption className="sr-only">Histórico de imagens processadas nesta sessão</caption>
          <thead>
            <tr className="border-b border-outline-variant/10 bg-surface-container/40">
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">Thumb</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">Arquivo</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">Antes &rarr; Depois</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">Status</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-on-surface-variant">Ação</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry, i) => (
              <tr key={`${entry.id}-${i}`} className="border-b border-outline-variant/10 last:border-0 bg-surface-container-low hover:bg-surface-container-high transition-colors">
                <td className="px-4 py-4">
                  {'thumbnailUrl' in entry && entry.thumbnailUrl ? (
                    <img src={entry.thumbnailUrl as string} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-surface-container-high flex items-center justify-center">
                      <svg className="h-5 w-5 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span className="font-mono text-xs text-on-surface">{entry.filename}</span>
                </td>
                <td className="px-4 py-4">
                  <span className="font-mono text-xs text-on-surface-variant">{entry.beforeSize}</span>
                  <span className="mx-1 text-outline">&rarr;</span>
                  <span className="font-mono text-xs text-primary">{entry.afterSize}</span>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    entry.status === "processed"
                      ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20"
                      : "bg-error-container/15 text-error ring-1 ring-error/20"
                  }`}>
                    {entry.status === "processed" ? "Processado" : "Erro"}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <a
                    href={`/api/v1/images/${entry.id}/download`}
                    download
                    className="text-xs text-primary hover:text-primary-dim"
                  >
                    Baixar
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
