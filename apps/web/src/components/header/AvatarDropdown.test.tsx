import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AvatarDropdown } from "./AvatarDropdown";

const mockToggleTheme = vi.fn();
let mockTheme = "dark";

vi.mock("@/stores/theme-store", () => ({
  useThemeStore: (selector: (s: { theme: string; toggleTheme: () => void }) => unknown) =>
    selector({ theme: mockTheme, toggleTheme: mockToggleTheme }),
}));

vi.mock("@/lib/auth-client", () => ({
  signOut: vi.fn(),
}));

const baseSession = {
  user: {
    name: "Gabriel Almeida",
    email: "gabriel@woli.com",
    emailVerified: true,
    image: null,
    username: "gabriel",
  },
};

describe("AvatarDropdown", () => {
  const onNavigateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = "dark";
  });

  it("renders user initials on the avatar button", () => {
    render(<AvatarDropdown session={baseSession} onNavigateSettings={onNavigateSettings} />);
    expect(screen.getByRole("button", { name: /menu do usuário/i })).toHaveTextContent("GA");
  });

  it("shows dropdown on click with user info", async () => {
    const user = userEvent.setup();
    render(<AvatarDropdown session={baseSession} onNavigateSettings={onNavigateSettings} />);

    await user.click(screen.getByRole("button", { name: /menu do usuário/i }));

    expect(screen.getByText("Gabriel Almeida")).toBeInTheDocument();
    expect(screen.getByText("gabriel@woli.com")).toBeInTheDocument();
  });

  it("closes dropdown when clicking avatar again", async () => {
    const user = userEvent.setup();
    render(<AvatarDropdown session={baseSession} onNavigateSettings={onNavigateSettings} />);

    const avatar = screen.getByRole("button", { name: /menu do usuário/i });
    await user.click(avatar);
    expect(screen.getByText("Gabriel Almeida")).toBeInTheDocument();

    await user.click(avatar);
    expect(screen.queryByText("Gabriel Almeida")).not.toBeInTheDocument();
  });

  it("calls toggleTheme when theme row is clicked", async () => {
    const user = userEvent.setup();
    render(<AvatarDropdown session={baseSession} onNavigateSettings={onNavigateSettings} />);

    await user.click(screen.getByRole("button", { name: /menu do usuário/i }));
    await user.click(screen.getByRole("button", { name: /alternar tema/i }));

    expect(mockToggleTheme).toHaveBeenCalledOnce();
  });

  it("calls onNavigateSettings and closes dropdown", async () => {
    const user = userEvent.setup();
    render(<AvatarDropdown session={baseSession} onNavigateSettings={onNavigateSettings} />);

    await user.click(screen.getByRole("button", { name: /menu do usuário/i }));
    await user.click(screen.getByRole("button", { name: /configurações/i }));

    expect(onNavigateSettings).toHaveBeenCalledOnce();
    expect(screen.queryByText("Gabriel Almeida")).not.toBeInTheDocument();
  });

  it("calls signOut when Sair is clicked", async () => {
    const { signOut } = await import("@/lib/auth-client");
    const user = userEvent.setup();
    render(<AvatarDropdown session={baseSession} onNavigateSettings={onNavigateSettings} />);

    await user.click(screen.getByRole("button", { name: /menu do usuário/i }));
    await user.click(screen.getByRole("button", { name: /sair/i }));

    expect(signOut).toHaveBeenCalled();
  });

  it("closes dropdown on Escape key", async () => {
    const user = userEvent.setup();
    render(<AvatarDropdown session={baseSession} onNavigateSettings={onNavigateSettings} />);

    await user.click(screen.getByRole("button", { name: /menu do usuário/i }));
    expect(screen.getByText("Gabriel Almeida")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Gabriel Almeida")).not.toBeInTheDocument();
  });

  it("falls back to 'U' when user has no name", () => {
    const noNameSession = { user: { ...baseSession.user, name: null } };
    render(<AvatarDropdown session={noNameSession} onNavigateSettings={onNavigateSettings} />);
    expect(screen.getByRole("button", { name: /menu do usuário/i })).toHaveTextContent("U");
  });

  it("shows initials until avatar image loads, then hides them", () => {
    const sessionWithImage = {
      user: { ...baseSession.user, image: "https://s3.example.com/avatar.webp" },
    };
    render(<AvatarDropdown session={sessionWithImage} onNavigateSettings={onNavigateSettings} />);

    const img = screen.getByAltText("Avatar");
    expect(img).toBeInTheDocument();

    // Before onLoad, initials should be visible as fallback
    expect(screen.getByRole("button", { name: /menu do usuário/i })).toHaveTextContent("GA");

    // After image loads, initials should be gone
    fireEvent.load(img);
    expect(screen.getByRole("button", { name: /menu do usuário/i })).not.toHaveTextContent("GA");
  });
});
