import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSessions } = vi.hoisted(() => ({
  mockSessions: [
    {
      id: "session-1",
      token: "current-token",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120",
      ipAddress: "192.168.1.1",
      createdAt: new Date("2026-04-01T10:00:00Z"),
    },
    {
      id: "session-2",
      token: "other-token",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605",
      ipAddress: "10.0.0.1",
      createdAt: new Date("2026-03-28T14:30:00Z"),
    },
  ],
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    listSessions: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
    revokeOtherSessions: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
  useSession: vi.fn().mockReturnValue({
    data: { session: { token: "current-token" } },
    isPending: false,
  }),
}));

import { authClient } from "@/lib/auth-client";
import { SessionsCard } from "./SessionsCard";

describe("SessionsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authClient.listSessions).mockResolvedValue({
      data: mockSessions,
      error: null,
    });
    vi.mocked(authClient.revokeOtherSessions).mockResolvedValue({
      data: {},
      error: null,
    });
  });

  it('renders title "Sessões Ativas"', () => {
    render(<SessionsCard />);
    expect(screen.getByText("Sessões Ativas")).toBeInTheDocument();
  });

  it("fetches sessions on mount and renders session list", async () => {
    render(<SessionsCard />);

    expect(authClient.listSessions).toHaveBeenCalledOnce();

    await waitFor(() => {
      expect(screen.getByText("192.168.1.1")).toBeInTheDocument();
    });

    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
  });

  it('marks the current session with "Sessão atual" badge', async () => {
    render(<SessionsCard />);

    await waitFor(() => {
      expect(screen.getByText("Sessão atual")).toBeInTheDocument();
    });

    const badges = screen.getAllByText("Sessão atual");
    expect(badges).toHaveLength(1);
  });

  it('shows "Revogar outras sessões" button', async () => {
    render(<SessionsCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Revogar outras sessões" }),
      ).toBeInTheDocument();
    });
  });

  it("calls authClient.revokeOtherSessions after window.confirm", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SessionsCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Revogar outras sessões" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Revogar outras sessões" }),
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      "Deseja revogar todas as outras sessões?",
    );
    expect(authClient.revokeOtherSessions).toHaveBeenCalledOnce();

    confirmSpy.mockRestore();
  });

  it("does not call revokeOtherSessions when confirm is cancelled", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SessionsCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Revogar outras sessões" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Revogar outras sessões" }),
    );

    expect(confirmSpy).toHaveBeenCalled();
    expect(authClient.revokeOtherSessions).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
