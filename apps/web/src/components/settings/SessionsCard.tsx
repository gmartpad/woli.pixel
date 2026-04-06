import { useEffect, useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";

interface Session {
  id: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

export function SessionsCard() {
  const { data: sessionData } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentToken = sessionData?.session?.token;

  useEffect(() => {
    authClient.listSessions().then(({ data }) => {
      if (data) {
        setSessions(data as Session[]);
      }
      setLoading(false);
    }).catch(() => {
      setError("Erro ao carregar sessões.");
      setLoading(false);
    });
  }, []);

  async function handleRevoke() {
    const confirmed = window.confirm(
      "Deseja revogar todas as outras sessões?",
    );
    if (!confirmed) return;

    try {
      await authClient.revokeOtherSessions();
      const { data } = await authClient.listSessions();
      if (data) {
        setSessions(data as Session[]);
      }
    } catch {
      setError("Erro ao revogar sessões.");
    }
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <h2 className="text-lg font-bold text-on-surface font-headline mb-4">
        Sessões Ativas
      </h2>

      {error && <p className="text-sm text-error mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Carregando sessões...</p>
      ) : (
        <>
          <ul className="space-y-3 mb-4">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="rounded-lg border border-outline-variant/30 p-3 flex items-start justify-between gap-2"
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">
                    {session.userAgent ?? "Agente desconhecido"}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {session.ipAddress ?? "IP desconhecido"}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {new Date(session.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {session.token === currentToken && (
                  <span className="rounded-full bg-primary/20 text-primary text-xs px-2 py-0.5 shrink-0">
                    Sessão atual
                  </span>
                )}
              </li>
            ))}
          </ul>

          <button
            onClick={handleRevoke}
            className="w-full rounded-lg border border-outline-variant/30 py-2 text-sm font-medium text-on-surface hover:bg-surface-variant/30 transition-colors cursor-pointer"
          >
            Revogar outras sessões
          </button>
        </>
      )}
    </div>
  );
}
