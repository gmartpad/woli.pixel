import { cn } from "@/lib/utils";

type Props = {
  stepNumber: number;
  title: string;
  isExpanded: boolean;
  isComplete: boolean;
  onToggle: () => void;
  summary?: string;
  children: React.ReactNode;
};

export function GenerateAccordionSection({
  stepNumber,
  title,
  isExpanded,
  isComplete,
  onToggle,
  summary,
  children,
}: Props) {
  return (
    <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low overflow-hidden">
      {/* Clickable header */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-container-high"
      >
        {/* Step number circle */}
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium",
            isComplete
              ? "bg-primary text-on-primary"
              : "bg-surface-container-high text-on-surface-variant",
          )}
        >
          {isComplete ? (
            <svg
              data-testid="completion-badge"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            stepNumber
          )}
        </span>

        {/* Title */}
        <span className="text-sm font-semibold text-on-surface">{title}</span>

        {/* Summary (when collapsed + complete) */}
        {!isExpanded && isComplete && summary && (
          <span className="ml-1 truncate text-sm text-on-surface-variant">
            — {summary}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Chevron */}
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "shrink-0 text-on-surface-variant transition-transform duration-200",
            isExpanded && "rotate-180",
          )}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Collapsible body — uses grid trick for smooth animation */}
      <div
        className="grid transition-[grid-template-rows] duration-200"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-5 pb-5 pt-1">{children}</div>
        </div>
      </div>
    </section>
  );
}
