import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { validatePassword } from "@/lib/password-validation";

describe("PasswordStrengthMeter", () => {
  it("renders all five rule labels", () => {
    const result = validatePassword("");
    render(<PasswordStrengthMeter validation={result} />);

    expect(screen.getByText("Mínimo de 8 caracteres")).toBeInTheDocument();
    expect(screen.getByText("Pelo menos 1 letra maiúscula")).toBeInTheDocument();
    expect(screen.getByText("Pelo menos 1 letra minúscula")).toBeInTheDocument();
    expect(screen.getByText("Pelo menos 1 número")).toBeInTheDocument();
    expect(screen.getByText("Pelo menos 1 caractere especial")).toBeInTheDocument();
  });

  it("shows 'Fraca' label for weak passwords", () => {
    const result = validatePassword("a");
    render(<PasswordStrengthMeter validation={result} />);
    expect(screen.getByText("Fraca")).toBeInTheDocument();
  });

  it("shows 'Média' label for medium passwords", () => {
    const result = validatePassword("abcdefgh");
    render(<PasswordStrengthMeter validation={result} />);
    expect(screen.getByText("Média")).toBeInTheDocument();
  });

  it("shows 'Forte' label for strong passwords", () => {
    const result = validatePassword("Abcdefg1");
    render(<PasswordStrengthMeter validation={result} />);
    expect(screen.getByText("Forte")).toBeInTheDocument();
  });

  it("shows 'Muito Forte' label for very strong passwords", () => {
    const result = validatePassword("Abcdef1!");
    render(<PasswordStrengthMeter validation={result} />);
    expect(screen.getByText("Muito Forte")).toBeInTheDocument();
  });

  it("renders meter with correct aria attributes", () => {
    const result = validatePassword("Abcdefg1");
    render(<PasswordStrengthMeter validation={result} />);

    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "5");
    expect(meter).toHaveAttribute("aria-valuenow", "4");
  });

  it("visually distinguishes met vs unmet rules", () => {
    const result = validatePassword("abcdefgh"); // length + lowercase met
    render(<PasswordStrengthMeter validation={result} />);

    const lengthItem = screen.getByText("Mínimo de 8 caracteres").closest("li");
    const uppercaseItem = screen.getByText("Pelo menos 1 letra maiúscula").closest("li");

    expect(lengthItem).toHaveAttribute("data-met", "true");
    expect(uppercaseItem).toHaveAttribute("data-met", "false");
  });
});
