import { useState } from "react";
import { authClient } from "@/lib/auth-client";

interface LoginPageProps {
  onSwitch: () => void;
  onSuccess: () => void;
  onForgot: () => void;
}

export function LoginPage({ onSwitch, onSuccess, onForgot }: LoginPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const isEmail = identifier.includes("@");
      const result = isEmail
        ? await authClient.signIn.email({ email: identifier, password })
        : await authClient.signIn.username({ username: identifier, password });

      if (result.error) {
        setError(result.error.message || "Erro ao fazer login");
      } else {
        onSuccess();
      }
    } catch {
      setError("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    authClient.signIn.social({
      provider: "google",
      callbackURL: window.location.origin,
    });
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-on-surface font-headline">
          Woli <span className="text-primary">Pixel</span>
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">Entre na sua conta</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-on-surface-variant mb-1">
            E-mail ou usuário
          </label>
          <input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="seu@email.com ou username"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-on-surface-variant mb-1">
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Sua senha"
          />
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={onForgot} className="text-xs text-primary hover:underline">
            Esqueceu a senha?
          </button>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-2.5 text-sm font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)] disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-outline-variant/20" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface px-2 text-outline">ou</span>
        </div>
      </div>

      <button
        onClick={handleGoogle}
        type="button"
        className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low py-2.5 text-sm font-medium text-on-surface transition-all hover:bg-surface-container-high"
      >
        Continuar com Google
      </button>

      <p className="text-center text-sm text-on-surface-variant">
        Não tem conta?{" "}
        <button onClick={onSwitch} className="font-medium text-primary hover:underline">
          Criar conta
        </button>
      </p>
    </div>
  );
}
