import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppearanceCard } from "./AppearanceCard";

const mockToggleTheme = vi.fn();
let mockTheme = "dark";

vi.mock("@/stores/theme-store", () => ({
  useThemeStore: (selector: (s: { theme: string; toggleTheme: () => void }) => unknown) =>
    selector({ theme: mockTheme, toggleTheme: mockToggleTheme }),
}));

describe("AppearanceCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = "dark";
  });

  it("renders the title 'Aparência'", () => {
    render(<AppearanceCard />);
    expect(screen.getByText("Aparência")).toBeInTheDocument();
  });

  it("renders both theme options: Escuro and Claro", () => {
    render(<AppearanceCard />);
    expect(screen.getByText("Escuro")).toBeInTheDocument();
    expect(screen.getByText("Claro")).toBeInTheDocument();
  });

  it("highlights the dark box when theme is dark", () => {
    mockTheme = "dark";
    render(<AppearanceCard />);

    const darkButton = screen.getByRole("button", { name: /escuro/i });
    const lightButton = screen.getByRole("button", { name: /claro/i });

    expect(darkButton.className).toMatch(/border-primary/);
    expect(lightButton.className).not.toMatch(/border-primary/);
  });

  it("highlights the light box when theme is light", () => {
    mockTheme = "light";
    render(<AppearanceCard />);

    const darkButton = screen.getByRole("button", { name: /escuro/i });
    const lightButton = screen.getByRole("button", { name: /claro/i });

    expect(lightButton.className).toMatch(/border-primary/);
    expect(darkButton.className).not.toMatch(/border-primary/);
  });

  it("shows a checkmark on the active theme option", () => {
    mockTheme = "dark";
    render(<AppearanceCard />);

    const darkButton = screen.getByRole("button", { name: /escuro/i });
    const lightButton = screen.getByRole("button", { name: /claro/i });

    expect(darkButton.querySelector("svg")).toBeInTheDocument();
    expect(lightButton.querySelector("svg")).toBeNull();
  });

  it("calls toggleTheme when clicking the inactive option", async () => {
    mockTheme = "dark";
    const user = userEvent.setup();
    render(<AppearanceCard />);

    await user.click(screen.getByRole("button", { name: /claro/i }));
    expect(mockToggleTheme).toHaveBeenCalledOnce();
  });

  it("does NOT call toggleTheme when clicking the already-active option", async () => {
    mockTheme = "dark";
    const user = userEvent.setup();
    render(<AppearanceCard />);

    await user.click(screen.getByRole("button", { name: /escuro/i }));
    expect(mockToggleTheme).not.toHaveBeenCalled();
  });
});
