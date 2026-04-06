import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RegisterPage } from "./RegisterPage";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: {
      email: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

describe("RegisterPage", () => {
  it("renders name, email, username, and password inputs", () => {
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/usuário/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it("renders create account button", () => {
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByRole("button", { name: /criar conta/i })).toBeInTheDocument();
  });

  it("renders link to login", () => {
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/já tem conta/i)).toBeInTheDocument();
  });
});
