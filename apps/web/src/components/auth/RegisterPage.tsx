import { useState } from "react";
import { authClient } from "@/lib/auth-client";

interface RegisterPageProps {
  onSwitch: () => void;
  onSuccess: () => void;
}

export function RegisterPage({ onSwitch, onSuccess }: RegisterPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        setError(result.error.message || "Erro ao criar conta");
      } else {
        setVerificationSent(true);
      }
    } catch {
      setError("Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  if (verificationSent) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-4 text-center">
        <h2 className="text-xl font-bold text-on-surface font-headline">Verifique seu e-mail</h2>
        <p className="text-sm text-on-surface-variant">
          Enviamos um link de verificação para <strong className="text-on-surface">{email}</strong>.
          Clique no link para ativar sua conta.
        </p>
        <button onClick={onSwitch} className="text-sm font-medium text-primary hover:underline">
          Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-on-surface font-headline">
          Woli <span className="text-primary">Pixel</span>
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">Crie sua conta</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-on-surface-variant mb-1">Nome</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Seu nome"
          />
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-on-surface-variant mb-1">E-mail</label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="seu@email.com"
          />
        </div>

        <div>
          <label htmlFor="reg-username" className="block text-sm font-medium text-on-surface-variant mb-1">Usuário</label>
          <input
            id="reg-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="seu_username"
          />
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-on-surface-variant mb-1">Senha</label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
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
