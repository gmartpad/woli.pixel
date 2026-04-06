import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileCard } from "./ProfileCard";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
}));

// AvatarUpload is tested independently — render a simple stub here
vi.mock("./AvatarUpload", () => ({
  AvatarUpload: ({ session }: { session: { user: { image?: string | null } } }) => (
    <div data-testid="avatar-upload">
      {session.user.image && <img src={session.user.image} alt="Avatar stub" />}
    </div>
  ),
}));

import { authClient } from "@/lib/auth-client";

const mockSession = {
  user: {
    name: "Gabriel Padoin",
    email: "gabriel@woli.com",
    emailVerified: true,
    image: "https://example.com/avatar.png",
    username: "gpadoin",
  },
};

describe("ProfileCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authClient.updateUser).mockResolvedValue({
      data: {},
      error: null,
    });
  });

  it('renders title "Perfil"', () => {
    render(<ProfileCard session={mockSession} />);
    expect(screen.getByText("Perfil")).toBeInTheDocument();
  });

  it("pre-fills name and username inputs, and renders AvatarUpload", () => {
    render(<ProfileCard session={mockSession} />);

    expect(screen.getByLabelText("Nome")).toHaveValue("Gabriel Padoin");
    expect(screen.getByLabelText("Nome de usuário")).toHaveValue("gpadoin");
    expect(screen.getByTestId("avatar-upload")).toBeInTheDocument();
  });

  it("displays email as read-only with verification badge when verified", () => {
    render(<ProfileCard session={mockSession} />);

    const emailInput = screen.getByLabelText("E-mail");
    expect(emailInput).toHaveValue("gabriel@woli.com");
    expect(emailInput).toHaveAttribute("readOnly");
    expect(screen.getByText("Verificado")).toBeInTheDocument();
  });

  it("does not show verification badge when email is not verified", () => {
    const unverifiedSession = {
      user: {
        ...mockSession.user,
        emailVerified: false,
      },
    };
    render(<ProfileCard session={unverifiedSession} />);

    expect(screen.queryByText("Verificado")).not.toBeInTheDocument();
  });

  it("calls authClient.updateUser with name and username on submit (avatar managed separately)", async () => {
    const user = userEvent.setup();
    render(<ProfileCard session={mockSession} />);

    const nameInput = screen.getByLabelText("Nome");
    await user.clear(nameInput);
    await user.type(nameInput, "Gabriel Martins");

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(authClient.updateUser).toHaveBeenCalledWith({
        name: "Gabriel Martins",
        username: "gpadoin",
      });
    });
  });

  it("shows loading state while submitting (button disabled)", async () => {
    const user = userEvent.setup();

    let resolveUpdate: (value: { data: {}; error: null }) => void;
    vi.mocked(authClient.updateUser).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(<ProfileCard session={mockSession} />);

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Salvando..." }),
      ).toBeDisabled();
    });

    resolveUpdate!({ data: {}, error: null });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Salvar alterações" }),
      ).toBeEnabled();
    });
  });

  it("shows success message after save", async () => {
    const user = userEvent.setup();
    render(<ProfileCard session={mockSession} />);

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(
        screen.getByText("Alterações salvas com sucesso!"),
      ).toBeInTheDocument();
    });
  });

  it("shows error message on API error", async () => {
    const user = userEvent.setup();

    vi.mocked(authClient.updateUser).mockResolvedValueOnce({
      data: null,
      error: { message: "Falha ao atualizar perfil" },
    });

    render(<ProfileCard session={mockSession} />);

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(
        screen.getByText("Falha ao atualizar perfil"),
      ).toBeInTheDocument();
    });
  });
});
