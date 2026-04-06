import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-errors";

interface ForgotPasswordPageProps {
  onBack: () => void;
}

export function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authClient.forgetPassword({
        email,
        redirectTo: `${window.location.origin}?reset=true`,
      });

      if (result.error) {
        setError(translateAuthError(result.error.message ?? "Erro ao enviar e-mail"));
      } else {
        setSent(true);
      }
    } catch {
      setError("Erro ao enviar e-mail");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-4 text-center">
        <h2 className="text-xl font-bold text-on-surface font-headline">E-mail enviado</h2>
        <p className="text-sm text-on-surface-variant">
          Se o e-mail <strong className="text-on-surface">{email}</strong> estiver cadastrado,
          você receberá um link para redefinir sua senha.
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
          Redefinir senha
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Informe seu e-mail para receber o link de redefinição
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-on-surface-variant mb-1">
            E-mail
          </label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="seu@email.com"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-2.5 text-sm font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)] disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar link"}
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
