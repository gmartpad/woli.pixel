import type { PasswordValidationResult } from "@/lib/password-validation";

const STRENGTH_LABELS: Record<string, string> = {
  weak: "Fraca",
  medium: "Média",
  strong: "Forte",
  "very-strong": "Muito Forte",
};

const STRENGTH_COLORS: Record<string, string> = {
  weak: "bg-error",
  medium: "bg-warning",
  strong: "bg-success",
  "very-strong": "bg-success",
};

const STRENGTH_TEXT_COLORS: Record<string, string> = {
  weak: "text-error",
  medium: "text-warning",
  strong: "text-success",
  "very-strong": "text-success",
};

const SEGMENT_COUNT = 4;

interface PasswordStrengthMeterProps {
  validation: PasswordValidationResult;
}

export function PasswordStrengthMeter({ validation }: PasswordStrengthMeterProps) {
  const { rules, strength, score } = validation;
  const filledSegments =
    strength === "weak"
      ? score >= 1 ? 1 : 0
      : strength === "medium"
        ? 2
        : strength === "strong"
          ? 3
          : SEGMENT_COUNT;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          role="meter"
          aria-label="Força da senha"
          aria-valuemin={0}
          aria-valuemax={5}
          aria-valuenow={score}
          className="flex flex-1 gap-1"
        >
          {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < filledSegments ? STRENGTH_COLORS[strength] : "bg-outline-variant/30"
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${STRENGTH_TEXT_COLORS[strength]}`}>
          {STRENGTH_LABELS[strength]}
        </span>
      </div>

      <ul className="space-y-1">
        {rules.map((rule) => (
          <li
            key={rule.key}
            data-met={rule.met}
            className="flex items-center gap-1.5 text-xs"
          >
            {rule.met ? (
              <svg className="h-3.5 w-3.5 text-success" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5 text-outline" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span className={rule.met ? "text-on-surface-variant" : "text-outline"}>
              {rule.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
