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
    localStorage.clear();
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

  // localStorage-based verification toast tests
  it("shows toast when session is verified AND pending-verification flag matches email", () => {
    localStorage.setItem("pending-verification", "user@example.com");
    mockUseSession.mockReturnValue({
      data: { user: { emailVerified: true, email: "user@example.com" } },
      isPending: false,
    });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(mockToastSuccess).toHaveBeenCalledWith(
      "E-mail verificado com sucesso!",
      { description: "Sua conta está ativa." }
    );
  });

  it("does NOT show toast when session is verified but no localStorage flag", () => {
    mockUseSession.mockReturnValue({
      data: { user: { emailVerified: true, email: "user@example.com" } },
      isPending: false,
    });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("does NOT show toast if localStorage email does not match session email", () => {
    localStorage.setItem("pending-verification", "other@example.com");
    mockUseSession.mockReturnValue({
      data: { user: { emailVerified: true, email: "user@example.com" } },
      isPending: false,
    });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("clears pending-verification from localStorage after showing toast", () => {
    localStorage.setItem("pending-verification", "user@example.com");
    mockUseSession.mockReturnValue({
      data: { user: { emailVerified: true, email: "user@example.com" } },
      isPending: false,
    });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(localStorage.getItem("pending-verification")).toBeNull();
  });

  it("clears verify-email from sessionStorage when verification completes", () => {
    localStorage.setItem("pending-verification", "user@example.com");
    sessionStorage.setItem("verify-email", "user@example.com");
    mockUseSession.mockReturnValue({
      data: { user: { emailVerified: true, email: "user@example.com" } },
      isPending: false,
    });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(sessionStorage.getItem("verify-email")).toBeNull();
  });

  it("sets pending-verification in localStorage when registration succeeds", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    await user.click(screen.getByText("Criar conta"));
    await user.click(screen.getByText("Simulate Success"));

    expect(localStorage.getItem("pending-verification")).toBe("test@example.com");
  });

  it("shows toast when session transitions from pending to verified (rerender)", () => {
    localStorage.setItem("pending-verification", "user@example.com");

    // Initially: not verified
    mockUseSession.mockReturnValue({
      data: { user: { emailVerified: false, email: "user@example.com" } },
      isPending: false,
    });

    const { rerender } = render(<AuthGuard><div>App</div></AuthGuard>);

    expect(mockToastSuccess).not.toHaveBeenCalled();

    // Session updates: now verified
    mockUseSession.mockReturnValue({
      data: { user: { emailVerified: true, email: "user@example.com" } },
      isPending: false,
    });

    rerender(<AuthGuard><div>App</div></AuthGuard>);

    expect(mockToastSuccess).toHaveBeenCalledWith(
      "E-mail verificado com sucesso!",
      { description: "Sua conta está ativa." }
    );
  });

  it("clears localStorage when 'Voltar ao login' is clicked", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("verify-email", "test@example.com");
    localStorage.setItem("pending-verification", "test@example.com");
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthGuard><div>App</div></AuthGuard>);

    expect(screen.getByText("Verifique seu e-mail")).toBeInTheDocument();

    await user.click(screen.getByText("Voltar ao login"));

    expect(localStorage.getItem("pending-verification")).toBeNull();
    expect(sessionStorage.getItem("verify-email")).toBeNull();
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
  });

  // Existing sessionStorage persistence tests
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
});
