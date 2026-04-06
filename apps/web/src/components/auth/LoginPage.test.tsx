import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginPage } from "./LoginPage";

const { mockSignInEmail, mockSendVerification, mockToggleTheme } = vi.hoisted(() => ({
  mockSignInEmail: vi.fn(),
  mockSendVerification: vi.fn(),
  mockToggleTheme: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: mockSignInEmail,
      username: vi.fn().mockResolvedValue({ data: null, error: null }),
      social: vi.fn(),
    },
    sendVerificationEmail: mockSendVerification,
  },
}));

vi.mock("@/stores/theme-store", () => ({
  useThemeStore: (selector: any) =>
    selector({ theme: "dark", toggleTheme: mockToggleTheme }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockSignInEmail.mockReset().mockResolvedValue({ data: null, error: null });
    mockSendVerification.mockReset().mockResolvedValue({ data: null, error: null });
    mockToggleTheme.mockClear();
  });

  it("renders email/username and password inputs", () => {
    render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);
    expect(screen.getByLabelText(/e-mail ou usuário/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("renders sign-in button", () => {
    render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("renders Google sign-in button", () => {
    render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
  });

  it("renders link to registration", () => {
    render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);
    expect(screen.getByText(/criar conta/i)).toBeInTheDocument();
  });

  it("renders forgot password link", () => {
    render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);
    expect(screen.getByText(/esqueceu a senha/i)).toBeInTheDocument();
  });

  describe("password visibility toggle", () => {
    it("renders password input with type password by default", () => {
      render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);
      expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    });

    it("toggles password visibility when clicking the eye icon", async () => {
      const user = userEvent.setup();
      render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /mostrar senha/i }));
      expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");

      await user.click(screen.getByRole("button", { name: /ocultar senha/i }));
      expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    });
  });

  describe("theme toggle", () => {
    it("renders theme toggle button", () => {
      render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);
      expect(screen.getByRole("button", { name: /mudar para tema/i })).toBeInTheDocument();
    });

    it("calls toggleTheme when clicked", async () => {
      const user = userEvent.setup();
      render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /mudar para tema/i }));
      expect(mockToggleTheme).toHaveBeenCalledOnce();
    });
  });

  describe("resend verification email", () => {
    it("shows resend button when login fails with email not verified", async () => {
      mockSignInEmail.mockResolvedValueOnce({
        data: null,
        error: { message: "Email not verified" },
      });
      const user = userEvent.setup();
      render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);

      await user.type(screen.getByLabelText(/e-mail ou usuário/i), "test@email.com");
      await user.type(screen.getByLabelText("Senha"), "password123");
      await user.click(screen.getByRole("button", { name: /entrar/i }));

      expect(await screen.findByText("E-mail não verificado")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reenviar/i })).toBeInTheDocument();
    });

    it("does not show resend button for other login errors", async () => {
      mockSignInEmail.mockResolvedValueOnce({
        data: null,
        error: { message: "Invalid email or password" },
      });
      const user = userEvent.setup();
      render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);

      await user.type(screen.getByLabelText(/e-mail ou usuário/i), "test@email.com");
      await user.type(screen.getByLabelText("Senha"), "wrong");
      await user.click(screen.getByRole("button", { name: /entrar/i }));

      expect(await screen.findByText("E-mail ou senha inválidos")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /reenviar/i })).not.toBeInTheDocument();
    });

    it("calls sendVerificationEmail with the entered email when resend is clicked", async () => {
      mockSignInEmail.mockResolvedValueOnce({
        data: null,
        error: { message: "Email not verified" },
      });
      const user = userEvent.setup();
      render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);

      await user.type(screen.getByLabelText(/e-mail ou usuário/i), "test@email.com");
      await user.type(screen.getByLabelText("Senha"), "password123");
      await user.click(screen.getByRole("button", { name: /entrar/i }));
      await user.click(await screen.findByRole("button", { name: /reenviar/i }));

      expect(mockSendVerification).toHaveBeenCalledWith({
        email: "test@email.com",
        callbackURL: window.location.origin,
      });
    });

    it("shows success message after resending", async () => {
      mockSignInEmail.mockResolvedValueOnce({
        data: null,
        error: { message: "Email not verified" },
      });
      const user = userEvent.setup();
      render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);

      await user.type(screen.getByLabelText(/e-mail ou usuário/i), "test@email.com");
      await user.type(screen.getByLabelText("Senha"), "password123");
      await user.click(screen.getByRole("button", { name: /entrar/i }));
      await user.click(await screen.findByRole("button", { name: /reenviar/i }));

      expect(await screen.findByText(/e-mail reenviado/i)).toBeInTheDocument();
    });
  });
});
