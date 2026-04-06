import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ResetPasswordPage } from "./ResetPasswordPage";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    resetPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe("ResetPasswordPage", () => {
  it("renders new password and confirm password inputs", () => {
    render(<ResetPasswordPage token="test-token" onBack={vi.fn()} />);
    expect(screen.getByLabelText(/nova senha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
  });

  it("renders reset button", () => {
    render(<ResetPasswordPage token="test-token" onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: /redefinir senha/i })).toBeInTheDocument();
  });

  it("renders back to login link", () => {
    render(<ResetPasswordPage token="test-token" onBack={vi.fn()} />);
    expect(screen.getByText(/voltar ao login/i)).toBeInTheDocument();
  });
});
