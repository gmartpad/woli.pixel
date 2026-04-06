import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { authClient } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-errors";
import { useThemeStore } from "@/stores/theme-store";
import { PasswordToggleButton } from "./PasswordToggleButton";

interface LoginPageProps {
  onSwitch: () => void;
  onSuccess: () => void;
  onForgot: () => void;
}

export function LoginPage({ onSwitch, onSuccess, onForgot }: LoginPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "loading" | "success">("idle");
  const { theme, toggleTheme } = useThemeStore(
    useShallow((s) => ({ theme: s.theme, toggleTheme: s.toggleTheme }))
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendState("idle");
    setLoading(true);

    try {
      const isEmail = identifier.includes("@");
      const result = isEmail
        ? await authClient.signIn.email({ email: identifier, password })
        : await authClient.signIn.username({ username: identifier, password });

      if (result.error) {
        setError(translateAuthError(result.error.message ?? "Erro ao fazer login"));
      } else {
        onSuccess();
      }
    } catch {
      setError("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendState("loading");
    try {
      await authClient.sendVerificationEmail({
        email: identifier,
        callbackURL: window.location.origin,
      });
      setResendState("success");
    } catch {
      setError("Erro ao reenviar e-mail");
      setResendState("idle");
    }
  }

  function handleGoogle() {
    authClient.signIn.social({
      provider: "google",
      callbackURL: window.location.origin,
    });
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-6 relative">
      <button
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
        className="absolute -top-2 right-0 rounded-lg p-1.5 text-outline hover:bg-surface-container-high hover:text-on-surface-variant transition-colors"
      >
        {theme === "dark" ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
        )}
      </button>
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
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 pr-9 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Sua senha"
            />
            <PasswordToggleButton visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={onForgot} className="text-xs text-primary hover:underline">
            Esqueceu a senha?
          </button>
        </div>

        {error && (
          <div className="space-y-1.5">
            <p className="text-sm text-error">{error}</p>
            {error === "E-mail não verificado" && resendState !== "success" && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendState === "loading"}
                className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
              >
                {resendState === "loading" ? "Reenviando..." : "Reenviar e-mail de verificação"}
              </button>
            )}
            {resendState === "success" && (
              <p className="text-sm text-success">
                E-mail reenviado! Verifique sua caixa de entrada.
              </p>
            )}
          </div>
        )}

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
        <span className="inline-flex items-center gap-2">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continuar com Google
        </span>
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
