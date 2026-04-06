import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DangerZoneCard } from "./DangerZoneCard";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
}));

import { authClient } from "@/lib/auth-client";

describe("DangerZoneCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title "Zona de Perigo"', () => {
    render(<DangerZoneCard />);
    expect(screen.getByText("Zona de Perigo")).toBeInTheDocument();
  });

  it("shows description explaining the action is irreversible", () => {
    render(<DangerZoneCard />);
    expect(
      screen.getByText(
        "Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos.",
      ),
    ).toBeInTheDocument();
  });

  it("delete button is initially disabled", () => {
    render(<DangerZoneCard />);
    expect(
      screen.getByRole("button", { name: "Excluir minha conta" }),
    ).toBeDisabled();
  });

  it('typing "EXCLUIR" in the confirmation input enables the button', async () => {
    const user = userEvent.setup();
    render(<DangerZoneCard />);

    const input = screen.getByLabelText("Digite EXCLUIR para confirmar");
    await user.type(input, "EXCLUIR");

    expect(
      screen.getByRole("button", { name: "Excluir minha conta" }),
    ).toBeEnabled();
  });

  it("typing something else keeps the button disabled", async () => {
    const user = userEvent.setup();
    render(<DangerZoneCard />);

    const input = screen.getByLabelText("Digite EXCLUIR para confirmar");
    await user.type(input, "excluir");

    expect(
      screen.getByRole("button", { name: "Excluir minha conta" }),
    ).toBeDisabled();
  });

  it("clicking enabled delete button calls authClient.deleteUser()", async () => {
    const user = userEvent.setup();
    render(<DangerZoneCard />);

    const input = screen.getByLabelText("Digite EXCLUIR para confirmar");
    await user.type(input, "EXCLUIR");

    await user.click(
      screen.getByRole("button", { name: "Excluir minha conta" }),
    );

    await waitFor(() => {
      expect(authClient.deleteUser).toHaveBeenCalledOnce();
    });
  });

  it("shows error if deleteUser fails", async () => {
    const user = userEvent.setup();

    vi.mocked(authClient.deleteUser).mockResolvedValueOnce({
      data: null,
      error: { message: "Erro ao excluir conta" },
    });

    render(<DangerZoneCard />);

    const input = screen.getByLabelText("Digite EXCLUIR para confirmar");
    await user.type(input, "EXCLUIR");

    await user.click(
      screen.getByRole("button", { name: "Excluir minha conta" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Erro ao excluir conta")).toBeInTheDocument();
    });
  });
});
