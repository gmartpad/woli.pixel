export const PASSWORD_POLICY = {
  minLength: 8,
  minUppercase: 1,
  minLowercase: 1,
  minDigits: 1,
  minSpecialChars: 1,
} as const;

export type PasswordStrength = "weak" | "medium" | "strong" | "very-strong";

export interface PasswordRuleResult {
  key: string;
  label: string;
  met: boolean;
}

export interface PasswordValidationResult {
  rules: PasswordRuleResult[];
  strength: PasswordStrength;
  allRulesMet: boolean;
  score: number;
}

const SPECIAL_CHARS = new Set(
  "!@#$%^&*()_+-=[]{}|;':\",./<>?~`\\".split("")
);

export function getStrengthFromScore(score: number): PasswordStrength {
  if (score <= 1) return "weak";
  if (score <= 3) return "medium";
  if (score === 4) return "strong";
  return "very-strong";
}

export function validatePassword(password: string): PasswordValidationResult {
  const rules: PasswordRuleResult[] = [
    {
      key: "minLength",
      label: "Mínimo de 8 caracteres",
      met: password.length >= PASSWORD_POLICY.minLength,
    },
    {
      key: "minUppercase",
      label: "Pelo menos 1 letra maiúscula",
      met: (password.match(/[A-Z]/g) ?? []).length >= PASSWORD_POLICY.minUppercase,
    },
    {
      key: "minLowercase",
      label: "Pelo menos 1 letra minúscula",
      met: (password.match(/[a-z]/g) ?? []).length >= PASSWORD_POLICY.minLowercase,
    },
    {
      key: "minDigits",
      label: "Pelo menos 1 número",
      met: (password.match(/\d/g) ?? []).length >= PASSWORD_POLICY.minDigits,
    },
    {
      key: "minSpecialChars",
      label: "Pelo menos 1 caractere especial",
      met:
        [...password].filter((ch) => SPECIAL_CHARS.has(ch)).length >=
        PASSWORD_POLICY.minSpecialChars,
    },
  ];

  const score = rules.filter((r) => r.met).length;
  const strength = getStrengthFromScore(score);
  const allRulesMet = score === rules.length;

  return { rules, strength, allRulesMet, score };
}

export function passwordsMatch(
  password: string,
  confirmPassword: string
): boolean {
  return password === confirmPassword;
}
