import { useState, useEffect } from "react";
import { toast } from "sonner";
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

    // Handle password reset token
    const token = params.get("token");
    if (token && params.get("reset") === "true") {
      setResetToken(token);
      setView("reset");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    // Restore verify-email view after registration (survives re-renders/refreshes)
    const pendingEmail = sessionStorage.getItem("verify-email");
    if (pendingEmail) {
      setVerificationEmail(pendingEmail);
      setView("verify-email");
    }
  }, []);

  // Show toast when email verification completes (localStorage flag + session watch)
  useEffect(() => {
    const pendingEmail = localStorage.getItem("pending-verification");
    if (session?.user?.emailVerified && pendingEmail && session.user.email === pendingEmail) {
      localStorage.removeItem("pending-verification");
      sessionStorage.removeItem("verify-email");
      toast.success("E-mail verificado com sucesso!", {
        description: "Sua conta está ativa.",
      });
    }
  }, [session]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-container-low text-on-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session || !session.user.emailVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-container-low text-on-surface px-4">
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
                sessionStorage.setItem("verify-email", email);
                localStorage.setItem("pending-verification", email);
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
                onClick={() => {
                  sessionStorage.removeItem("verify-email");
                  localStorage.removeItem("pending-verification");
                  setView("login");
                }}
                className="text-sm font-medium text-primary hover:underline"
              >
                Voltar ao login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
