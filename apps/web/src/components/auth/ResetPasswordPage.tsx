import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-errors";

interface ResetPasswordPageProps {
  token: string;
  onBack: () => void;
}

export function ResetPasswordPage({ token, onBack }: ResetPasswordPageProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(translateAuthError(result.error.message ?? "Erro ao redefinir senha"));
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-4 text-center">
        <h2 className="text-xl font-bold text-on-surface font-headline">Senha redefinida</h2>
        <p className="text-sm text-on-surface-variant">
          Sua senha foi atualizada com sucesso. Faça login com sua nova senha.
        </p>
        <button onClick={onBack} className="text-sm font-medium text-primary hover:underline">
          Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-on-surface font-headline">
          Nova senha
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Defina sua nova senha
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-on-surface-variant mb-1">
            Nova senha
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-on-surface-variant mb-1">
            Confirmar senha
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Repita a senha"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-2.5 text-sm font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)] disabled:opacity-50"
        >
          {loading ? "Redefinindo..." : "Redefinir senha"}
        </button>
      </form>

      <p className="text-center text-sm text-on-surface-variant">
        <button onClick={onBack} className="font-medium text-primary hover:underline">
          Voltar ao login
        </button>
      </p>
    </div>
  );
}
