import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";

interface AccountInfo {
  provider: string;
}

export function SecurityCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const result = await authClient.listAccounts();
        if (result.data) {
          setAccounts(result.data as AccountInfo[]);
          setGoogleLinked(
            (result.data as AccountInfo[]).some((a) => a.provider === "google"),
          );
        }
      } catch {
        // Gracefully handle: show read-only status
      } finally {
        setAccountsLoading(false);
      }
    }
    fetchAccounts();
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError("A nova senha deve ter pelo menos 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });

      if (result.error) {
        setPasswordError(
          typeof result.error === "object" && result.error !== null && "message" in result.error
            ? (result.error as { message: string }).message
            : "Erro ao alterar senha",
        );
      } else {
        setPasswordSuccess("Senha alterada com sucesso");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordError("Erro ao alterar senha");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLinkGoogle() {
    setLinkingGoogle(true);
    try {
      await authClient.linkSocial({
        provider: "google",
        callbackURL: window.location.origin,
      });
    } catch {
      // Gracefully handle
    } finally {
      setLinkingGoogle(false);
    }
  }

  async function handleUnlinkGoogle() {
    setLinkingGoogle(true);
    try {
      await authClient.unlinkAccount({ providerId: "google" });
      setGoogleLinked(false);
    } catch {
      // Gracefully handle: show read-only status
    } finally {
      setLinkingGoogle(false);
    }
  }

  const canUnlinkGoogle = googleLinked && accounts.some((a) => a.provider !== "google");

  const inputClass =
    "w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
  const labelClass = "block text-sm font-medium text-on-surface-variant mb-1";

  return (
    <div className="glass-card rounded-xl p-5">
      <h2 className="text-lg font-bold text-on-surface font-headline">
        Segurança
      </h2>

      <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
        <div>
          <label htmlFor="current-password" className={labelClass}>
            Senha atual
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="new-password" className={labelClass}>
            Nova senha
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className={labelClass}>
            Confirmar nova senha
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        {passwordError && (
          <p className="text-xs text-error mt-1">{passwordError}</p>
        )}

        {passwordSuccess && (
          <p className="text-xs text-success mt-1">{passwordSuccess}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
          className="rounded-lg bg-gradient-to-r from-primary to-primary-light px-4 py-2 text-sm font-medium text-on-primary shadow-sm transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Alterando..." : "Alterar senha"}
        </button>
      </form>

      <div className="border-t border-outline-variant/20 my-4" />

      <div>
        <h3 className="text-sm font-semibold text-on-surface mb-3">
          Contas vinculadas
        </h3>

        {accountsLoading ? (
          <p className="text-sm text-on-surface-variant">Carregando...</p>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-outline-variant/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span className="text-sm text-on-surface">Google</span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs ${googleLinked ? "text-success" : "text-on-surface-variant"}`}
              >
                {googleLinked ? "Vinculado" : "Não vinculado"}
              </span>

              {googleLinked ? (
                <div>
                  <button
                    type="button"
                    onClick={handleUnlinkGoogle}
                    disabled={linkingGoogle || !canUnlinkGoogle}
                    className="rounded-md border border-outline-variant/30 px-2 py-1 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-50"
                  >
                    Desvincular
                  </button>
                  {!canUnlinkGoogle && (
                    <p className="text-[10px] text-on-surface-variant mt-1">
                      Único método de login
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLinkGoogle}
                  disabled={linkingGoogle}
                  className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                >
                  Vincular
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
