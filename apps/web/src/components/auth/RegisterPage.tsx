import { useState } from "react";
import { z } from "zod";
import { useShallow } from "zustand/react/shallow";
import { authClient } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-errors";
import { validatePassword, passwordsMatch } from "@/lib/password-validation";
import { useThemeStore } from "@/stores/theme-store";
import { PasswordToggleButton } from "./PasswordToggleButton";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

const registerFieldSchemas = {
  name: z.string().min(1, "Campo obrigatório"),
  email: z.string().min(1, "Campo obrigatório").email("E-mail inválido"),
  username: z.string().min(1, "Campo obrigatório"),
  password: z.string().min(1, "Campo obrigatório"),
  confirmPassword: z.string().min(1, "Campo obrigatório"),
};

interface RegisterPageProps {
  onSwitch: () => void;
  onSuccess: (email: string) => void;
}

export function RegisterPage({ onSwitch, onSuccess }: RegisterPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const { theme, toggleTheme } = useThemeStore(
    useShallow((s) => ({ theme: s.theme, toggleTheme: s.toggleTheme }))
  );

  const validation = validatePassword(password);
  const matching = passwordsMatch(password, confirmPassword);

  const hasFieldErrors =
    !!getFieldError("name", name) ||
    !!getFieldError("email", email) ||
    !!getFieldError("username", username) ||
    !!getFieldError("password", password) ||
    !!getFieldError("confirmPassword", confirmPassword);

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function getFieldError(field: keyof typeof registerFieldSchemas, value: string): string | null {
    const result = registerFieldSchemas[field].safeParse(value);
    return result.success ? null : result.error.issues[0].message;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTouched({ name: true, email: true, username: true, password: true, confirmPassword: true });

    if (hasFieldErrors) return;

    setError(null);
    setLoading(true);

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
        username,
      });

      if (result.error) {
        setError(translateAuthError(result.error.message ?? "Erro ao criar conta"));
      } else {
        onSuccess(email);
      }
    } catch {
      setError("Erro ao criar conta");
    } finally {
      setLoading(false);
    }
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
        <p className="mt-2 text-sm text-on-surface-variant">Crie sua conta</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-on-surface-variant mb-1">Nome</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => handleBlur("name")}
            required
            className={`w-full rounded-lg border ${touched.name && getFieldError("name", name) ? "border-error" : "border-outline-variant/30"} bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`}
            placeholder="Seu nome"
          />
          {touched.name && getFieldError("name", name) && (
            <p className="mt-1 text-xs text-error">{getFieldError("name", name)}</p>
          )}
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-on-surface-variant mb-1">E-mail</label>
          <input
            id="reg-email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => handleBlur("email")}
            required
            className={`w-full rounded-lg border ${touched.email && getFieldError("email", email) ? "border-error" : "border-outline-variant/30"} bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`}
            placeholder="seu@email.com"
          />
          {touched.email && getFieldError("email", email) && (
            <p className="mt-1 text-xs text-error">{getFieldError("email", email)}</p>
          )}
        </div>

        <div>
          <label htmlFor="reg-username" className="block text-sm font-medium text-on-surface-variant mb-1">Usuário</label>
          <input
            id="reg-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => handleBlur("username")}
            required
            className={`w-full rounded-lg border ${touched.username && getFieldError("username", username) ? "border-error" : "border-outline-variant/30"} bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`}
            placeholder="seu_username"
          />
          {touched.username && getFieldError("username", username) && (
            <p className="mt-1 text-xs text-error">{getFieldError("username", username)}</p>
          )}
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-on-surface-variant mb-1">Senha</label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur("password")}
              required
              className={`w-full rounded-lg border ${touched.password && getFieldError("password", password) ? "border-error" : "border-outline-variant/30"} bg-surface-container-low px-3 py-2 pr-9 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`}
              placeholder="Mínimo 8 caracteres"
            />
            <PasswordToggleButton visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />
          </div>
          {touched.password && password.length === 0 && getFieldError("password", password) && (
            <p className="mt-1 text-xs text-error">{getFieldError("password", password)}</p>
          )}
          {password.length > 0 && (
            <div className="mt-2">
              <PasswordStrengthMeter validation={validation} />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-on-surface-variant mb-1">Confirmar Senha</label>
          <div className="relative">
            <input
              id="reg-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => handleBlur("confirmPassword")}
              required
              className={`w-full rounded-lg border ${touched.confirmPassword && getFieldError("confirmPassword", confirmPassword) ? "border-error" : "border-outline-variant/30"} bg-surface-container-low px-3 py-2 pr-9 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`}
              placeholder="Repita sua senha"
            />
            <PasswordToggleButton visible={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} label="confirmação de senha" />
          </div>
          {touched.confirmPassword && confirmPassword.length === 0 && getFieldError("confirmPassword", confirmPassword) && (
            <p className="mt-1 text-xs text-error">{getFieldError("confirmPassword", confirmPassword)}</p>
          )}
          {confirmPassword.length > 0 && (
            <p className={`mt-1 text-xs ${matching ? "text-success" : "text-error"}`}>
              {matching ? "As senhas coincidem" : "As senhas não coincidem"}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading || !validation.allRulesMet || !matching || (submitted && hasFieldErrors)}
          className="w-full rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-2.5 text-sm font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)] disabled:opacity-50"
        >
          {loading ? "Criando..." : "Criar conta"}
        </button>
      </form>

      <p className="text-center text-sm text-on-surface-variant">
        Já tem conta?{" "}
        <button onClick={onSwitch} className="font-medium text-primary hover:underline">
          Entrar
        </button>
      </p>
    </div>
  );
}
