import { cn } from "@/lib/utils";

type Props = {
  steps: { label: string }[];
  currentStep: number;
  onStepClick?: (step: number) => void;
};

export function WizardStepper({ steps, currentStep, onStepClick }: Props) {
  return (
    <nav aria-label="Progresso" className="mb-6">
      <ol className="flex items-center justify-center gap-0">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const canNavigate = isCompleted && !!onStepClick;

          const circle = (
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                isCompleted && "border-primary bg-primary text-on-primary",
                isCurrent && "border-primary bg-surface text-primary",
                !isCompleted && !isCurrent && "border-outline-variant/40 bg-surface text-on-surface-variant/60",
              )}
            >
              {isCompleted ? (
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
          );

          const label = (
            <span className={cn(
              "mt-1 text-xs font-medium",
              isCompleted || isCurrent ? "text-on-surface" : "text-on-surface-variant/60",
            )}>
              {step.label}
            </span>
          );

          return (
            <li key={step.label} className="flex items-center">
              {canNavigate ? (
                <button
                  type="button"
                  onClick={() => onStepClick(index)}
                  className="flex flex-col items-center gap-0.5 transition-opacity hover:opacity-80"
                >
                  {circle}
                  {label}
                </button>
              ) : (
                <div
                  {...(isCurrent ? { "aria-current": "step" as const } : {})}
                  className="flex flex-col items-center gap-0.5"
                >
                  {circle}
                  {label}
                </div>
              )}

              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 w-8 sm:w-12",
                    isCompleted ? "bg-primary" : "bg-outline-variant/30",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
