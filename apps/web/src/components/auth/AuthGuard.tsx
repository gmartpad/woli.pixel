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
  const [view, setView] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [resetToken, setResetToken] = useState<string | null>(null);

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

  if (!session) {
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
            onSuccess={() => setView("login")}
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
      </div>
    );
  }

  return <>{children}</>;
}
