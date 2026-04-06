# Wizard Refactors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor "Processar Imagem" into a 4-step linear wizard and "Gerar Imagem" into a 4-section accordion progressive form, both with a shared step indicator component.

**Architecture:** Shared `WizardStepper` component for progress visualization. Processar Imagem uses `useReducer` for strict linear flow. Gerar Imagem keeps `generation-store` but wraps sections in collapsible accordions with auto-expand logic. Existing child components are reused inside wizard steps/accordion sections.

**Tech Stack:** React 19, Zustand 5, Vitest + RTL, TailwindCSS 4

**Design doc:** `plans/13-wizard-refactor-design.md`

---

### Task 1: WizardStepper — Shared Component (TDD)

**Files:**
- Create: `apps/web/src/components/ui/WizardStepper.tsx`
- Create: `apps/web/src/components/ui/WizardStepper.test.tsx`

**Step 1: Write the failing tests**

```tsx
// WizardStepper.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { WizardStepper } from "./WizardStepper";

const steps = [
  { label: "Upload" },
  { label: "Análise" },
  { label: "Processar" },
  { label: "Resultado" },
];

describe("WizardStepper", () => {
  it("renders all step labels", () => {
    render(<WizardStepper steps={steps} currentStep={0} />);
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Análise")).toBeInTheDocument();
    expect(screen.getByText("Processar")).toBeInTheDocument();
    expect(screen.getByText("Resultado")).toBeInTheDocument();
  });

  it("marks current step with aria-current", () => {
    render(<WizardStepper steps={steps} currentStep={1} />);
    const current = screen.getByText("Análise").closest("[aria-current]");
    expect(current).toHaveAttribute("aria-current", "step");
  });

  it("completed steps are clickable when onStepClick provided", async () => {
    const user = userEvent.setup();
    const onStepClick = vi.fn();
    render(<WizardStepper steps={steps} currentStep={2} onStepClick={onStepClick} />);
    await user.click(screen.getByText("Upload"));
    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  it("future steps are NOT clickable", async () => {
    const user = userEvent.setup();
    const onStepClick = vi.fn();
    render(<WizardStepper steps={steps} currentStep={1} onStepClick={onStepClick} />);
    await user.click(screen.getByText("Resultado"));
    expect(onStepClick).not.toHaveBeenCalled();
  });

  it("does not render click handlers when onStepClick is omitted", () => {
    render(<WizardStepper steps={steps} currentStep={2} />);
    // Completed step should not be a button
    const upload = screen.getByText("Upload");
    expect(upload.closest("button")).toBeNull();
  });
});
```

**Step 2:** Run tests → RED (module not found)

**Step 3: Implement WizardStepper**

```tsx
// WizardStepper.tsx
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
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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

          const content = (
            <div className="flex flex-col items-center gap-0.5">
              {circle}
              {label}
            </div>
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

              {/* Connecting line */}
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
```

**Step 4:** Run tests → GREEN

**Step 5:** Run `bunx vitest run` for regressions

---

### Task 2: Process Wizard Reducer (TDD)

**Files:**
- Create: `apps/web/src/components/process/process-wizard-reducer.ts`
- Create: `apps/web/src/components/process/process-wizard-reducer.test.ts`

**Step 1: Write failing tests**

Test the reducer function directly (no rendering). Cover:
- Initial state has step 0, null file/analysis/result
- `SET_STEP` changes step and clears error
- `SET_FILE` stores file data
- `SET_ANALYSIS` stores AI analysis
- `SET_TYPE` stores selected type ID
- `SET_QUALITY` stores quality tier
- `SET_RESULT` stores processed result
- `SET_ERROR` stores error message
- `RESET` returns to initial state

**Step 2:** Run tests → RED

**Step 3: Implement reducer**

```ts
// process-wizard-reducer.ts
export type ProcessStep = 0 | 1 | 2 | 3; // upload, analysis, process, result

export type ProcessWizardState = {
  step: ProcessStep;
  uploadId: string | null;
  originalImage: {
    url: string;
    filename: string;
    width: number;
    height: number;
    sizeKb: number;
    format: string;
  } | null;
  analysis: {
    qualityScore: number | null;
    contentType: string | null;
    suggestedTypeId: string | null;
    suggestedTypeName: string | null;
  } | null;
  selectedTypeId: string | null;
  qualityTier: "low" | "medium" | "high";
  result: Record<string, unknown> | null;
  error: string | null;
  isUploading: boolean;
  isProcessing: boolean;
};

export type ProcessWizardAction =
  | { type: "SET_STEP"; step: ProcessStep }
  | { type: "SET_FILE"; uploadId: string; image: ProcessWizardState["originalImage"] }
  | { type: "SET_UPLOADING"; value: boolean }
  | { type: "SET_ANALYSIS"; analysis: ProcessWizardState["analysis"] }
  | { type: "SET_TYPE"; typeId: string }
  | { type: "SET_QUALITY"; tier: "low" | "medium" | "high" }
  | { type: "SET_PROCESSING"; value: boolean }
  | { type: "SET_RESULT"; result: Record<string, unknown> }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET" };

export const initialState: ProcessWizardState = {
  step: 0,
  uploadId: null,
  originalImage: null,
  analysis: null,
  selectedTypeId: null,
  qualityTier: "medium",
  result: null,
  error: null,
  isUploading: false,
  isProcessing: false,
};

export function processWizardReducer(
  state: ProcessWizardState,
  action: ProcessWizardAction,
): ProcessWizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step, error: null };
    case "SET_FILE":
      return { ...state, uploadId: action.uploadId, originalImage: action.image, isUploading: false };
    case "SET_UPLOADING":
      return { ...state, isUploading: action.value };
    case "SET_ANALYSIS":
      return { ...state, analysis: action.analysis };
    case "SET_TYPE":
      return { ...state, selectedTypeId: action.typeId };
    case "SET_QUALITY":
      return { ...state, qualityTier: action.tier };
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.value };
    case "SET_RESULT":
      return { ...state, result: action.result, isProcessing: false };
    case "SET_ERROR":
      return { ...state, error: action.error, isUploading: false, isProcessing: false };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}
```

**Step 4:** Run tests → GREEN

---

### Task 3: ProcessWizard Orchestrator + Step Components

**Files:**
- Create: `apps/web/src/components/process/ProcessWizard.tsx`
- Create: `apps/web/src/components/process/ProcessStepUpload.tsx`
- Create: `apps/web/src/components/process/ProcessStepAnalysis.tsx`
- Create: `apps/web/src/components/process/ProcessStepProcess.tsx`
- Create: `apps/web/src/components/process/ProcessStepResult.tsx`

**Context:** Each step component wraps the existing child components (`UploadZone`, `FileInfo`, `TypeConfirmation`, `ProcessingSpinner`, `ResultsPanel`) but manages navigation via the wizard reducer. The orchestrator renders the `WizardStepper` + current step.

**Implementation approach:**

1. **ProcessWizard.tsx** — `useReducer(processWizardReducer, initialState)`, renders `WizardStepper` at top, conditionally renders step components based on `state.step`. Handles API calls (upload, analyze, process) and dispatches results to reducer.

2. **ProcessStepUpload.tsx** — Wraps existing `UploadZone`. Props: `onFileSelected`, `isUploading`, `error`. Renders the upload zone + a "Next" area (auto-advances after upload succeeds).

3. **ProcessStepAnalysis.tsx** — Shows uploaded image thumbnail + metadata (reuse `FileInfo` display logic). Shows AI analysis results. Type selector (reuse category tabs + type cards from `TypeConfirmation`). "Voltar" and "Continuar" buttons.

4. **ProcessStepProcess.tsx** — Quality selector + optional crop + "Processar" button. Shows `ProcessingSpinner` while processing. Auto-advances to step 4 when done.

5. **ProcessStepResult.tsx** — Wraps existing `ResultsPanel` display. Before/after comparison. Download button. "Nova Imagem" button calls `dispatch({ type: "RESET" })`.

**Each step component receives:**
```ts
type StepProps = {
  state: ProcessWizardState;
  dispatch: React.Dispatch<ProcessWizardAction>;
};
```

Plus any step-specific callbacks for API interactions.

**Step 1:** Create all files with basic structure and test each renders.
**Step 2:** Wire API calls (upload, analyze, process) into the orchestrator.
**Step 3:** Run existing tests + add integration test for wizard render.

---

### Task 4: Wire ProcessWizard into App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx` (lines 286-308 — "single" mode rendering)

**Changes:** Replace the 7 scattered component renders in "single" mode:
```tsx
// Before: 7 separate components
<UploadZone />
<UploadProgress />
<FileInfo />
<TypeConfirmation />
<ProcessingSpinner />
<ResultsPanel />
<CostEstimationPanel />

// After: 1 wizard component
<ProcessWizard />
```

Keep `CostEstimationPanel` outside the wizard if it's independent. Keep `ContextPreview` and `DownloadSection` if they're still relevant.

**Step 1:** Read App.tsx, identify exact lines for "single" mode render.
**Step 2:** Replace with `<ProcessWizard />` import.
**Step 3:** Run full test suite, verify no regressions.

---

### Task 5: GenerateAccordionSection — Reusable Component (TDD)

**Files:**
- Create: `apps/web/src/components/generate/GenerateAccordionSection.tsx`
- Create: `apps/web/src/components/generate/GenerateAccordionSection.test.tsx`

**Step 1: Write failing tests**

```tsx
describe("GenerateAccordionSection", () => {
  it("renders title and children when expanded", () => {
    render(
      <GenerateAccordionSection
        stepNumber={1}
        title="Descreva a Imagem"
        isExpanded={true}
        isComplete={false}
        onToggle={vi.fn()}
      >
        <p>content</p>
      </GenerateAccordionSection>
    );
    expect(screen.getByText("Descreva a Imagem")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("hides children when collapsed", () => {
    render(
      <GenerateAccordionSection
        stepNumber={2}
        title="Tipo"
        isExpanded={false}
        isComplete={false}
        onToggle={vi.fn()}
      >
        <p>hidden content</p>
      </GenerateAccordionSection>
    );
    // Content should be in collapsed container (not visible)
    expect(screen.queryByText("hidden content")).not.toBeVisible();
  });

  it("shows completion badge when isComplete", () => {
    render(
      <GenerateAccordionSection
        stepNumber={1}
        title="Prompt"
        isExpanded={false}
        isComplete={true}
        onToggle={vi.fn()}
        summary="A beautiful landscape..."
      >
        <p>content</p>
      </GenerateAccordionSection>
    );
    expect(screen.getByTestId("completion-badge")).toBeInTheDocument();
    expect(screen.getByText("A beautiful landscape...")).toBeInTheDocument();
  });

  it("calls onToggle when header is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <GenerateAccordionSection
        stepNumber={1}
        title="Prompt"
        isExpanded={false}
        isComplete={false}
        onToggle={onToggle}
      >
        <p>content</p>
      </GenerateAccordionSection>
    );
    await user.click(screen.getByText("Prompt"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
```

**Step 2:** Run tests → RED

**Step 3: Implement**

Props type:
```ts
type Props = {
  stepNumber: number;
  title: string;
  isExpanded: boolean;
  isComplete: boolean;
  onToggle: () => void;
  summary?: string;
  children: React.ReactNode;
};
```

Header: step number circle + title + completion checkmark + collapsed summary. Clickable to toggle.
Body: animated expand/collapse using `grid-template-rows: 0fr/1fr` trick (same as HistoryGrid accordions).

**Step 4:** Run tests → GREEN

---

### Task 6: GenerateAccordion — Orchestrator

**Files:**
- Create: `apps/web/src/components/generate/GenerateAccordion.tsx`
- Create: `apps/web/src/components/generate/GenerateSectionPrompt.tsx`
- Create: `apps/web/src/components/generate/GenerateSectionType.tsx`
- Create: `apps/web/src/components/generate/GenerateSectionQuality.tsx`
- Create: `apps/web/src/components/generate/GenerateSectionResult.tsx`

**Context:** Each section component extracts a logical chunk from the current 1200-line `GeneratePanel.tsx`. The orchestrator manages which sections are expanded and renders the `WizardStepper` at top in indicator-only mode (no onStepClick).

**Implementation approach:**

1. **GenerateAccordion.tsx** — Manages `expandedSections: Set<number>` state. Renders `WizardStepper` (indicator mode) + 4 `GenerateAccordionSection` wrappers. Auto-expand logic:
   - Section 1 (prompt): expanded by default
   - Section 2 (type): auto-expand when prompt ≥ 10 chars
   - Section 3 (quality): auto-expand when type selected
   - Section 4 (result): auto-expand when generation completes
   Uses existing `useGenerationStore` for all state.

2. **GenerateSectionPrompt.tsx** — Prompt textarea. Extracted from GeneratePanel lines ~175-210.

3. **GenerateSectionType.tsx** — Category tabs + type cards + custom mode. The largest section. Extracted from GeneratePanel lines ~210-350.

4. **GenerateSectionQuality.tsx** — Quality selector + cost estimate + "Gerar Imagem" button. Extracted from GeneratePanel lines ~350-420.

5. **GenerateSectionResult.tsx** — Result preview + download + moderation alert + error + "Nova Geração". Extracted from GeneratePanel lines ~420-507.

**Step 1:** Create orchestrator with section state management.
**Step 2:** Extract each section from GeneratePanel into its own component.
**Step 3:** Wire API calls (generate, download) through the orchestrator or keep in store.

---

### Task 7: Wire GenerateAccordion into App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx` (line ~346 — "generate" mode rendering)

**Changes:**
```tsx
// Before
<GeneratePanel />

// After
<GenerateAccordion />
```

**Step 1:** Read App.tsx, find the generate mode render.
**Step 2:** Replace with `<GenerateAccordion />`.
**Step 3:** Run full test suite, verify no regressions.
**Step 4:** Manual test both flows end-to-end.

---

## Task Dependency Graph

```
Task 1 (WizardStepper)  ────────────┐
                                     │
Task 2 (Process reducer)  ──┐       │
                            ├── Task 3 (Process steps) ── Task 4 (Wire into App)
Task 1 ─────────────────────┘       │
                                     │
Task 5 (AccordionSection)  ──┐      │
                             ├── Task 6 (Generate sections) ── Task 7 (Wire into App)
Task 1 ──────────────────────┘
```

**Parallelizable:** Tasks 2+5 (reducer + accordion section) after Task 1.
**Then:** Tasks 3+6 in parallel (different directories).
**Finally:** Tasks 4+7 sequentially (both touch App.tsx).

## Verification

```bash
# Frontend tests
cd apps/web && bunx vitest run

# Manual: Processar Imagem
# 1. Navigate to "Processar Imagem" → see stepper at top
# 2. Upload image → auto-advance to step 2
# 3. See AI analysis, select type → click "Continuar"
# 4. Select quality, click "Processar" → spinner → auto-advance to results
# 5. Before/after comparison → download → "Nova Imagem" resets

# Manual: Gerar Imagem
# 1. Navigate to "Gerar Imagem" → see step indicator + section 1 expanded
# 2. Type prompt (10+ chars) → section 2 auto-expands
# 3. Select type → section 3 auto-expands
# 4. Select quality → click "Gerar Imagem"
# 5. Section 4 expands with result → download → "Nova Geração"
# 6. Click section 1 header → collapses/expands → edit prompt → regenerate
```
