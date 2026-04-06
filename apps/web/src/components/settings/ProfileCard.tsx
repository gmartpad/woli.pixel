import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AvatarUpload } from "./AvatarUpload";

interface ProfileCardProps {
  session: {
    user: {
      name: string | null;
      email: string;
      emailVerified: boolean;
      image?: string | null;
      username?: string | null;
      [key: string]: unknown;
    };
  };
}

export function ProfileCard({ session }: ProfileCardProps) {
  const [name, setName] = useState(session.user.name ?? "");
  const [username, setUsername] = useState(session.user.username ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const result = await authClient.updateUser({ name, username });

      if (result.error) {
        setStatusMessage({
          type: "error",
          text: result.error.message ?? "Erro ao salvar alterações.",
        });
      } else {
        setStatusMessage({
          type: "success",
          text: "Alterações salvas com sucesso!",
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Erro ao salvar alterações.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
  const labelClass = "block text-sm font-medium text-on-surface-variant mb-1";

  return (
    <div className="glass-card rounded-xl p-5">
      <h2 className="text-lg font-bold text-on-surface font-headline">
        Perfil
      </h2>

      <div className="mt-4">
        <AvatarUpload session={session} />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="profile-name" className={labelClass}>
            Nome
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="profile-username" className={labelClass}>
            Nome de usuário
          </label>
          <input
            id="profile-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="profile-email" className={labelClass}>
            E-mail
          </label>
          <div className="flex items-center gap-2">
            <input
              id="profile-email"
              type="email"
              value={session.user.email}
              readOnly
              className={`${inputClass} cursor-not-allowed opacity-70`}
            />
            {session.user.emailVerified && (
              <span className="shrink-0 rounded-full bg-success-container px-2 py-0.5 text-xs font-medium text-success">
                Verificado
              </span>
            )}
          </div>
        </div>

        {statusMessage && (
          <p
            className={
              statusMessage.type === "success"
                ? "text-sm text-success"
                : "text-sm text-error"
            }
          >
            {statusMessage.text}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-2.5 text-sm font-bold text-on-primary hover:shadow-[0_0_20px_rgba(133,173,255,0.3)] disabled:opacity-50"
        >
          {isSubmitting ? "Salvando..." : "Salvar alterações"}
        </button>
      </form>
    </div>
  );
}
