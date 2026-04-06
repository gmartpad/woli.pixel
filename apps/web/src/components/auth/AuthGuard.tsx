import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { ResetPasswordPage } from "./ResetPasswordPage";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, isPending } = useSession();
  const [view, setView] = useState<"login" | "register" | "forgot" | "reset" | "verify-email">("login");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token && params.get("reset") === "true") {
      setResetToken(token);
      setView("reset");
      // Clean the URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session || !session.user.emailVerified) {
    return (
      <div className="w-full">
        {view === "login" && (
          <LoginPage
            onSwitch={() => setView("register")}
            onSuccess={() => window.location.reload()}
            onForgot={() => setView("forgot")}
          />
        )}
        {view === "register" && (
          <RegisterPage
            onSwitch={() => setView("login")}
            onSuccess={(email: string) => {
              setVerificationEmail(email);
              setView("verify-email");
            }}
          />
        )}
        {view === "forgot" && (
          <ForgotPasswordPage
            onBack={() => setView("login")}
          />
        )}
        {view === "reset" && resetToken && (
          <ResetPasswordPage
            token={resetToken}
            onBack={() => {
              setResetToken(null);
              setView("login");
            }}
          />
        )}
        {view === "verify-email" && verificationEmail && (
          <div className="mx-auto w-full max-w-sm space-y-4 text-center">
            <h2 className="text-xl font-bold text-on-surface font-headline">Verifique seu e-mail</h2>
            <p className="text-sm text-on-surface-variant">
              Enviamos um link de verificação para <strong className="text-on-surface">{verificationEmail}</strong>.
              Clique no link para ativar sua conta.
            </p>
            <button
              onClick={() => setView("login")}
              className="text-sm font-medium text-primary hover:underline"
            >
              Voltar ao login
            </button>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
