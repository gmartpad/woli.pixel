import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockToastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

const mockUseSession = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

vi.mock("./LoginPage", () => ({
  LoginPage: ({ onSwitch, onForgot }: { onSwitch: () => void; onForgot: () => void }) => (
    <div data-testid="login-page">
      <button onClick={onSwitch}>Criar conta</button>
      <button onClick={onForgot}>Esqueceu a senha</button>
    </div>
  ),
}));

vi.mock("./RegisterPage", () => ({
  RegisterPage: ({ onSwitch, onSuccess }: { onSwitch: () => void; onSuccess: (email: string) => void }) => (
    <div data-testid="register-page">
      Register
      <button onClick={onSwitch}>Voltar</button>
      <button onClick={() => onSuccess("test@example.com")}>Simulate Success</button>
    </div>
  ),
}));

vi.mock("./ForgotPasswordPage", () => ({
  ForgotPasswordPage: () => <div data-testid="forgot-page">Forgot</div>,
}));

vi.mock("./ResetPasswordPage", () => ({
  ResetPasswordPage: () => <div data-testid="reset-page">Reset</div>,
}));

import { AuthGuard } from "./AuthGuard";

const replaceStateSpy = vi.spyOn(window.history, "replaceState");

function setLocation(params: { search?: string; hash?: string }) {
  Object.defineProperty(window, "location", {
    value: {
      ...window.location,
      search: params.search ?? "",
      hash: params.hash ?? "",
      pathname: "/",
    },
    writable: true,
  });
}

describe("AuthGuard", () => {
  beforeEach(() => {
    mockUseSession.mockReset();
    mockToastSuccess.mockReset();
    replaceStateSpy.mockReset();
    sessionStorage.clear();
    setLocation({});
  });

  it("shows spinner when session is pending", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(screen.queryByText("App")).not.toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  it("shows LoginPage when session is null", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByText("App")).not.toBeInTheDocument();
  });

  it("shows auth views when session.user.emailVerified is false", () => {
    mockUseSession.mockReturnValue({
      data: { user: { emailVerified: false } },
      isPending: false,
    });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByText("App")).not.toBeInTheDocument();
  });

  it("renders children when session.user.emailVerified is true", () => {
    mockUseSession.mockReturnValue({
      data: { user: { emailVerified: true } },
      isPending: false,
    });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(screen.getByText("App")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  it("switches to RegisterPage when user clicks register link", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    await user.click(screen.getByText("Criar conta"));

    expect(screen.getByTestId("register-page")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  it("shows verify-email view when RegisterPage calls onSuccess with email", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    await user.click(screen.getByText("Criar conta"));
    await user.click(screen.getByText("Simulate Success"));

    expect(screen.getByText("Verifique seu e-mail")).toBeInTheDocument();
    expect(screen.getByText(/test@example\.com/)).toBeInTheDocument();
    expect(screen.queryByTestId("register-page")).not.toBeInTheDocument();
  });

  it("switches from verify-email back to login when clicking back button", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    await user.click(screen.getByText("Criar conta"));
    await user.click(screen.getByText("Simulate Success"));

    expect(screen.getByText("Verifique seu e-mail")).toBeInTheDocument();

    await user.click(screen.getByText("Voltar ao login"));

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByText("Verifique seu e-mail")).not.toBeInTheDocument();
  });

  // Bug fix #2: Toast detection via hash fragment instead of query param
  it("shows success toast when #verified hash is present", () => {
    setLocation({ hash: "#verified" });
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(mockToastSuccess).toHaveBeenCalledWith(
      "E-mail verificado com sucesso!",
      { description: "Sua conta está ativa." }
    );
  });

  it("does NOT show toast on normal page load without #verified hash", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("cleans URL after detecting #verified hash", () => {
    setLocation({ hash: "#verified" });
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/");
  });

  it("shows toast on dashboard when user is authenticated and #verified hash is present", () => {
    setLocation({ hash: "#verified" });
    mockUseSession.mockReturnValue({
      data: { user: { emailVerified: true } },
      isPending: false,
    });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(mockToastSuccess).toHaveBeenCalledWith(
      "E-mail verificado com sucesso!",
      { description: "Sua conta está ativa." }
    );
    expect(screen.getByText("App")).toBeInTheDocument();
  });

  // Bug fix #1: sessionStorage persistence for verify-email view
  it("sets sessionStorage when registration succeeds", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    await user.click(screen.getByText("Criar conta"));
    await user.click(screen.getByText("Simulate Success"));

    expect(sessionStorage.getItem("verify-email")).toBe("test@example.com");
  });

  it("restores verify-email view from sessionStorage on mount", () => {
    sessionStorage.setItem("verify-email", "restored@example.com");
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(screen.getByText("Verifique seu e-mail")).toBeInTheDocument();
    expect(screen.getByText(/restored@example\.com/)).toBeInTheDocument();
  });

  it("clears sessionStorage when 'Voltar ao login' is clicked", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("verify-email", "test@example.com");
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(screen.getByText("Verifique seu e-mail")).toBeInTheDocument();

    await user.click(screen.getByText("Voltar ao login"));

    expect(sessionStorage.getItem("verify-email")).toBeNull();
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
  });

  it("clears sessionStorage when #verified hash is detected", () => {
    sessionStorage.setItem("verify-email", "test@example.com");
    setLocation({ hash: "#verified" });
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(sessionStorage.getItem("verify-email")).toBeNull();
    expect(mockToastSuccess).toHaveBeenCalled();
  });
});
