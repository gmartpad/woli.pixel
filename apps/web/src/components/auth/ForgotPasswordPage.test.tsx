import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    forgetPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe("ForgotPasswordPage", () => {
  it("renders email input", () => {
    render(<ForgotPasswordPage onBack={vi.fn()} />);
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
  });

  it("renders send button", () => {
    render(<ForgotPasswordPage onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: /enviar link/i })).toBeInTheDocument();
  });

  it("renders back to login link", () => {
    render(<ForgotPasswordPage onBack={vi.fn()} />);
    expect(screen.getByText(/voltar ao login/i)).toBeInTheDocument();
  });
});
