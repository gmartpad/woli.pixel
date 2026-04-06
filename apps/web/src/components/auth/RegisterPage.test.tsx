import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegisterPage } from "./RegisterPage";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: {
      email: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

const { mockToggleTheme } = vi.hoisted(() => ({
  mockToggleTheme: vi.fn(),
}));

vi.mock("@/stores/theme-store", () => ({
  useThemeStore: (selector: any) =>
    selector({ theme: "dark", toggleTheme: mockToggleTheme }),
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    mockToggleTheme.mockClear();
  });
  it("renders name, email, username, and password inputs", () => {
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/usuário/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
  });

  it("renders create account button", () => {
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByRole("button", { name: /criar conta/i })).toBeInTheDocument();
  });

  it("renders link to login", () => {
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/já tem conta/i)).toBeInTheDocument();
  });

  it("renders confirm password field", () => {
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
  });

  it("renders password strength meter when typing password", async () => {
    const user = userEvent.setup();
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/^senha$/i), "a");
    expect(screen.getByRole("meter")).toBeInTheDocument();
  });

  it("disables submit when password rules are not met", async () => {
    const user = userEvent.setup();
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/nome/i), "Test");
    await user.type(screen.getByLabelText(/e-mail/i), "test@test.com");
    await user.type(screen.getByLabelText(/usuário/i), "testuser");
    await user.type(screen.getByLabelText(/^senha$/i), "weak");
    await user.type(screen.getByLabelText(/confirmar senha/i), "weak");

    expect(screen.getByRole("button", { name: /criar conta/i })).toBeDisabled();
  });

  it("disables submit when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/^senha$/i), "Abcdef1!");
    await user.type(screen.getByLabelText(/confirmar senha/i), "Abcdef1@");

    expect(screen.getByRole("button", { name: /criar conta/i })).toBeDisabled();
  });

  it("enables submit when all rules met and passwords match", async () => {
    const user = userEvent.setup();
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/nome/i), "Test");
    await user.type(screen.getByLabelText(/e-mail/i), "test@test.com");
    await user.type(screen.getByLabelText(/usuário/i), "testuser");
    await user.type(screen.getByLabelText(/^senha$/i), "Abcdef1!");
    await user.type(screen.getByLabelText(/confirmar senha/i), "Abcdef1!");

    expect(screen.getByRole("button", { name: /criar conta/i })).toBeEnabled();
  });

  it("shows mismatch message when confirm password differs", async () => {
    const user = userEvent.setup();
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/^senha$/i), "Abcdef1!");
    await user.type(screen.getByLabelText(/confirmar senha/i), "Abcdef1@");

    expect(screen.getByText("As senhas não coincidem")).toBeInTheDocument();
  });

  it("shows match message when passwords match and confirm is not empty", async () => {
    const user = userEvent.setup();
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/^senha$/i), "Abcdef1!");
    await user.type(screen.getByLabelText(/confirmar senha/i), "Abcdef1!");

    expect(screen.getByText("As senhas coincidem")).toBeInTheDocument();
  });

  it("hides match message when confirm password is empty", () => {
    render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.queryByText("As senhas coincidem")).not.toBeInTheDocument();
    expect(screen.queryByText("As senhas não coincidem")).not.toBeInTheDocument();
  });

  describe("on-blur field validation", () => {
    it("shows no field errors before any interaction", () => {
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      expect(screen.queryByText("Campo obrigatório")).not.toBeInTheDocument();
      expect(screen.queryByText("E-mail inválido")).not.toBeInTheDocument();
    });

    it("shows 'Campo obrigatório' on name after focus and blur when empty", async () => {
      const user = userEvent.setup();
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      const nameInput = screen.getByLabelText(/nome/i);
      await user.click(nameInput);
      await user.tab();

      expect(screen.getByText("Campo obrigatório")).toBeInTheDocument();
    });

    it("shows 'E-mail inválido' on email after typing invalid format and blur", async () => {
      const user = userEvent.setup();
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      const emailInput = screen.getByLabelText(/e-mail/i);
      await user.type(emailInput, "gabrielmpwork");
      await user.tab();

      expect(screen.getByText("E-mail inválido")).toBeInTheDocument();
    });

    it("shows 'Campo obrigatório' on username after focus and blur when empty", async () => {
      const user = userEvent.setup();
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      const usernameInput = screen.getByLabelText(/usuário/i);
      await user.click(usernameInput);
      await user.tab();

      expect(screen.getByText("Campo obrigatório")).toBeInTheDocument();
    });

    it("does not show error on a field that has not been blurred", async () => {
      const user = userEvent.setup();
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      await user.type(screen.getByLabelText(/e-mail/i), "invalid");

      expect(screen.queryByText("E-mail inválido")).not.toBeInTheDocument();
      expect(screen.queryByText("Campo obrigatório")).not.toBeInTheDocument();
    });

    it("clears error when user corrects the field value", async () => {
      const user = userEvent.setup();
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      const emailInput = screen.getByLabelText(/e-mail/i);
      await user.type(emailInput, "invalid");
      await user.tab();
      expect(screen.getByText("E-mail inválido")).toBeInTheDocument();

      await user.clear(emailInput);
      await user.type(emailInput, "valid@email.com");

      expect(screen.queryByText("E-mail inválido")).not.toBeInTheDocument();
    });
  });

  describe("password visibility toggle", () => {
    it("renders password input with type password by default", () => {
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);
      expect(screen.getByLabelText(/^senha$/i)).toHaveAttribute("type", "password");
    });

    it("toggles password visibility when clicking the eye icon", async () => {
      const user = userEvent.setup();
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /mostrar senha/i }));
      expect(screen.getByLabelText(/^senha$/i)).toHaveAttribute("type", "text");

      await user.click(screen.getByRole("button", { name: /ocultar senha/i }));
      expect(screen.getByLabelText(/^senha$/i)).toHaveAttribute("type", "password");
    });

    it("toggles confirm password visibility independently", async () => {
      const user = userEvent.setup();
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /mostrar confirmação/i }));
      expect(screen.getByLabelText(/confirmar senha/i)).toHaveAttribute("type", "text");
      expect(screen.getByLabelText(/^senha$/i)).toHaveAttribute("type", "password");

      await user.click(screen.getByRole("button", { name: /ocultar confirmação/i }));
      expect(screen.getByLabelText(/confirmar senha/i)).toHaveAttribute("type", "password");
    });
  });

  describe("theme toggle", () => {
    it("renders theme toggle button", () => {
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);
      expect(screen.getByRole("button", { name: /mudar para tema/i })).toBeInTheDocument();
    });

    it("calls toggleTheme when clicked", async () => {
      const user = userEvent.setup();
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /mudar para tema/i }));
      expect(mockToggleTheme).toHaveBeenCalledOnce();
    });
  });

  describe("submit with invalid fields", () => {
    it("disables button after submit attempt with invalid fields", async () => {
      const user = userEvent.setup();
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      await user.type(screen.getByLabelText(/nome/i), "Test");
      await user.type(screen.getByLabelText(/e-mail/i), "invalid");
      await user.type(screen.getByLabelText(/usuário/i), "testuser");
      await user.type(screen.getByLabelText(/^senha$/i), "Abcdef1!");
      await user.type(screen.getByLabelText(/confirmar senha/i), "Abcdef1!");

      await user.click(screen.getByRole("button", { name: /criar conta/i }));

      expect(screen.getByRole("button", { name: /criar conta/i })).toBeDisabled();
    });

    it("marks all fields as touched on submit attempt showing errors for empty fields", async () => {
      const user = userEvent.setup();
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      // Fill only password fields so the button is clickable
      await user.type(screen.getByLabelText(/^senha$/i), "Abcdef1!");
      await user.type(screen.getByLabelText(/confirmar senha/i), "Abcdef1!");

      await user.click(screen.getByRole("button", { name: /criar conta/i }));

      // Name, email, username are empty — should show errors
      expect(screen.getAllByText("Campo obrigatório").length).toBeGreaterThanOrEqual(3);
    });

    it("re-enables button after fixing the invalid field", async () => {
      const user = userEvent.setup();
      render(<RegisterPage onSwitch={vi.fn()} onSuccess={vi.fn()} />);

      await user.type(screen.getByLabelText(/nome/i), "Test");
      await user.type(screen.getByLabelText(/e-mail/i), "invalid");
      await user.type(screen.getByLabelText(/usuário/i), "testuser");
      await user.type(screen.getByLabelText(/^senha$/i), "Abcdef1!");
      await user.type(screen.getByLabelText(/confirmar senha/i), "Abcdef1!");

      await user.click(screen.getByRole("button", { name: /criar conta/i }));
      expect(screen.getByRole("button", { name: /criar conta/i })).toBeDisabled();

      const emailInput = screen.getByLabelText(/e-mail/i);
      await user.clear(emailInput);
      await user.type(emailInput, "valid@email.com");

      expect(screen.getByRole("button", { name: /criar conta/i })).toBeEnabled();
    });
  });
});
