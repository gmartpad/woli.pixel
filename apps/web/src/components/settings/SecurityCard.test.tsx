import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SecurityCard } from "./SecurityCard";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    changePassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    listAccounts: vi.fn().mockResolvedValue({ data: [{ provider: "credential" }], error: null }),
    linkSocial: vi.fn().mockResolvedValue({ data: {}, error: null }),
    unlinkAccount: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
}));

import { authClient } from "@/lib/auth-client";

beforeEach(() => {
  vi.clearAllMocks();
  (authClient.listAccounts as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: [{ provider: "credential" }],
    error: null,
  });
});

describe("SecurityCard", () => {
  it("renders title 'Seguranca'", () => {
    render(<SecurityCard />);
    expect(screen.getByText("Segurança")).toBeInTheDocument();
  });

  it("renders password change form with 3 inputs", () => {
    render(<SecurityCard />);
    expect(screen.getByLabelText("Senha atual")).toBeInTheDocument();
    expect(screen.getByLabelText("Nova senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar nova senha")).toBeInTheDocument();
  });

  it("shows validation error when new password is less than 8 characters", async () => {
    const user = userEvent.setup();
    render(<SecurityCard />);

    await user.type(screen.getByLabelText("Senha atual"), "oldpass123");
    await user.type(screen.getByLabelText("Nova senha"), "short");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "short");
    await user.click(screen.getByRole("button", { name: /alterar senha/i }));

    expect(screen.getByText("A nova senha deve ter pelo menos 8 caracteres")).toBeInTheDocument();
    expect(authClient.changePassword).not.toHaveBeenCalled();
  });

  it("shows validation error when passwords don't match", async () => {
    const user = userEvent.setup();
    render(<SecurityCard />);

    await user.type(screen.getByLabelText("Senha atual"), "oldpass123");
    await user.type(screen.getByLabelText("Nova senha"), "newpassword1");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "newpassword2");
    await user.click(screen.getByRole("button", { name: /alterar senha/i }));

    expect(screen.getByText("As senhas não coincidem")).toBeInTheDocument();
    expect(authClient.changePassword).not.toHaveBeenCalled();
  });

  it("calls authClient.changePassword with correct params on valid submit", async () => {
    const user = userEvent.setup();
    render(<SecurityCard />);

    await user.type(screen.getByLabelText("Senha atual"), "oldpass123");
    await user.type(screen.getByLabelText("Nova senha"), "newpassword1");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "newpassword1");
    await user.click(screen.getByRole("button", { name: /alterar senha/i }));

    await waitFor(() => {
      expect(authClient.changePassword).toHaveBeenCalledWith({
        currentPassword: "oldpass123",
        newPassword: "newpassword1",
        revokeOtherSessions: false,
      });
    });
  });

  it("shows 'Contas vinculadas' section", () => {
    render(<SecurityCard />);
    expect(screen.getByText("Contas vinculadas")).toBeInTheDocument();
  });

  it("fetches accounts on mount via authClient.listAccounts()", async () => {
    render(<SecurityCard />);

    await waitFor(() => {
      expect(authClient.listAccounts).toHaveBeenCalled();
    });
  });

  it("disables 'Alterar senha' button when all fields are empty", () => {
    render(<SecurityCard />);
    expect(screen.getByRole("button", { name: /alterar senha/i })).toBeDisabled();
  });

  it("enables 'Alterar senha' button when all fields are filled", async () => {
    const user = userEvent.setup();
    render(<SecurityCard />);
    await user.type(screen.getByLabelText("Senha atual"), "oldpass");
    await user.type(screen.getByLabelText("Nova senha"), "newpass12");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "newpass12");
    expect(screen.getByRole("button", { name: /alterar senha/i })).toBeEnabled();
  });

  it("disables 'Desvincular' when Google is the only login method", async () => {
    (authClient.listAccounts as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ provider: "google" }],
    });
    render(<SecurityCard />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /desvincular/i })).toBeDisabled();
    });
    expect(screen.getByText(/único método de login/i)).toBeInTheDocument();
  });

  it("enables 'Desvincular' when user has both credential and Google", async () => {
    (authClient.listAccounts as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ provider: "credential" }, { provider: "google" }],
    });
    render(<SecurityCard />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /desvincular/i })).toBeEnabled();
    });
  });
});
