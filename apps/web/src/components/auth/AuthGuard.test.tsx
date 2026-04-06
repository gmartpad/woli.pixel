import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  RegisterPage: () => <div data-testid="register-page">Register</div>,
}));

vi.mock("./ForgotPasswordPage", () => ({
  ForgotPasswordPage: () => <div data-testid="forgot-page">Forgot</div>,
}));

vi.mock("./ResetPasswordPage", () => ({
  ResetPasswordPage: () => <div data-testid="reset-page">Reset</div>,
}));

import { AuthGuard } from "./AuthGuard";

describe("AuthGuard", () => {
  beforeEach(() => {
    mockUseSession.mockReset();
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
});
