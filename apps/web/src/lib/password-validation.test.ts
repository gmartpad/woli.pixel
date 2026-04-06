import { describe, it, expect } from "vitest";
import {
  PASSWORD_POLICY,
  validatePassword,
  passwordsMatch,
  getStrengthFromScore,
} from "./password-validation";
import type { PasswordStrength } from "./password-validation";

describe("PASSWORD_POLICY", () => {
  it("defines all five rules", () => {
    expect(PASSWORD_POLICY.minLength).toBe(8);
    expect(PASSWORD_POLICY.minUppercase).toBe(1);
    expect(PASSWORD_POLICY.minLowercase).toBe(1);
    expect(PASSWORD_POLICY.minDigits).toBe(1);
    expect(PASSWORD_POLICY.minSpecialChars).toBe(1);
  });
});

describe("validatePassword", () => {
  it("returns all rules unmet for empty string", () => {
    const result = validatePassword("");
    expect(result.score).toBe(0);
    expect(result.allRulesMet).toBe(false);
    expect(result.rules.every((r) => !r.met)).toBe(true);
  });

  it("detects minimum length rule", () => {
    const short = validatePassword("Ab1!xyz");
    expect(short.rules.find((r) => r.key === "minLength")?.met).toBe(false);

    const ok = validatePassword("Ab1!xyzw");
    expect(ok.rules.find((r) => r.key === "minLength")?.met).toBe(true);
  });

  it("detects uppercase rule", () => {
    const noUpper = validatePassword("abcdefgh");
    expect(noUpper.rules.find((r) => r.key === "minUppercase")?.met).toBe(false);

    const hasUpper = validatePassword("Abcdefgh");
    expect(hasUpper.rules.find((r) => r.key === "minUppercase")?.met).toBe(true);
  });

  it("detects lowercase rule", () => {
    const noLower = validatePassword("ABCDEFGH");
    expect(noLower.rules.find((r) => r.key === "minLowercase")?.met).toBe(false);

    const hasLower = validatePassword("ABCDEFGh");
    expect(hasLower.rules.find((r) => r.key === "minLowercase")?.met).toBe(true);
  });

  it("detects digit rule", () => {
    const noDigit = validatePassword("Abcdefgh");
    expect(noDigit.rules.find((r) => r.key === "minDigits")?.met).toBe(false);

    const hasDigit = validatePassword("Abcdefg1");
    expect(hasDigit.rules.find((r) => r.key === "minDigits")?.met).toBe(true);
  });

  it("detects special character rule", () => {
    const noSpecial = validatePassword("Abcdefg1");
    expect(noSpecial.rules.find((r) => r.key === "minSpecialChars")?.met).toBe(false);

    const hasSpecial = validatePassword("Abcdef1!");
    expect(hasSpecial.rules.find((r) => r.key === "minSpecialChars")?.met).toBe(true);
  });

  it("recognizes various special characters", () => {
    const specials = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "_", "+"];
    for (const ch of specials) {
      const result = validatePassword(`Abcdef1${ch}`);
      expect(result.rules.find((r) => r.key === "minSpecialChars")?.met).toBe(true);
    }
  });

  it("computes correct score", () => {
    expect(validatePassword("").score).toBe(0);
    expect(validatePassword("abcdefgh").score).toBe(2); // length + lowercase
    expect(validatePassword("Abcdefgh").score).toBe(3); // + uppercase
    expect(validatePassword("Abcdefg1").score).toBe(4); // + digit
    expect(validatePassword("Abcdef1!").score).toBe(5); // all met
  });

  it("sets allRulesMet true only when all 5 rules pass", () => {
    expect(validatePassword("Abcdef1!").allRulesMet).toBe(true);
    expect(validatePassword("Abcdefg1").allRulesMet).toBe(false);
    expect(validatePassword("abcdef1!").allRulesMet).toBe(false);
  });

  it("returns rules with Portuguese labels", () => {
    const result = validatePassword("");
    const labels = result.rules.map((r) => r.label);
    expect(labels).toContain("Mínimo de 8 caracteres");
    expect(labels).toContain("Pelo menos 1 letra maiúscula");
    expect(labels).toContain("Pelo menos 1 letra minúscula");
    expect(labels).toContain("Pelo menos 1 número");
    expect(labels).toContain("Pelo menos 1 caractere especial");
  });

  it("always returns exactly 5 rules", () => {
    expect(validatePassword("").rules).toHaveLength(5);
    expect(validatePassword("Abcdef1!").rules).toHaveLength(5);
  });

  it("maps score to correct strength tier", () => {
    expect(validatePassword("").strength).toBe("weak");
    expect(validatePassword("a").strength).toBe("weak");
    expect(validatePassword("abcdefgh").strength).toBe("medium");
    expect(validatePassword("Abcdefgh").strength).toBe("medium");
    expect(validatePassword("Abcdefg1").strength).toBe("strong");
    expect(validatePassword("Abcdef1!").strength).toBe("very-strong");
  });
});

describe("getStrengthFromScore", () => {
  it("returns weak for 0-1", () => {
    expect(getStrengthFromScore(0)).toBe("weak");
    expect(getStrengthFromScore(1)).toBe("weak");
  });

  it("returns medium for 2-3", () => {
    expect(getStrengthFromScore(2)).toBe("medium");
    expect(getStrengthFromScore(3)).toBe("medium");
  });

  it("returns strong for 4", () => {
    expect(getStrengthFromScore(4)).toBe("strong");
  });

  it("returns very-strong for 5", () => {
    expect(getStrengthFromScore(5)).toBe("very-strong");
  });
});

describe("passwordsMatch", () => {
  it("returns true when passwords are identical", () => {
    expect(passwordsMatch("Abcdef1!", "Abcdef1!")).toBe(true);
  });

  it("returns false when passwords differ", () => {
    expect(passwordsMatch("Abcdef1!", "Abcdef1@")).toBe(false);
  });

  it("returns false for empty vs non-empty", () => {
    expect(passwordsMatch("Abcdef1!", "")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(passwordsMatch("", "")).toBe(true);
  });
});
