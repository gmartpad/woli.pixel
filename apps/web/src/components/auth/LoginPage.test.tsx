import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LoginPage } from "./LoginPage";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn().mockResolvedValue({ data: null, error: null }),
      username: vi.fn().mockResolvedValue({ data: null, error: null }),
      social: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

describe("LoginPage", () => {
  it("renders email/username and password inputs", () => {
    render(<LoginPage onSwitch={vi.fn()} onSuccess={vi.fn()} onForgot={vi.fn()} />);
    expect(screen.getByLabelText(/e-mail ou usuário/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
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
});
