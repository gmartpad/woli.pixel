# Wizard Refactors for Gerar Imagem & Processar Imagem — Design

## Problem

Both "Gerar Imagem" and "Processar Imagem" flows lack visual structure. The generation page is a 1200-line monolith with all controls dumped on one scrollable page. The processing flow is scattered across 6 disconnected components with no progress indicator. Users get no sense of where they are in the process or what comes next.

## Research Summary

- AI/creative tools (Midjourney, DALL-E, Canva, Squoosh) reject strict wizards — creative iteration needs all controls accessible
- Linear upload→process→result flows (like crochet-tryon) benefit from step-by-step wizards
- The middle ground is a "progressive form" — sections on one page with a step indicator

## Solution

Two different patterns matched to each flow's nature:

1. **Processar Imagem → Linear Wizard** (upload→analyze→process→result is sequential)
2. **Gerar Imagem → Accordion Progressive Form** (creative iteration needs all sections accessible)

---

## Part 1: Processar Imagem — Linear Wizard

### Current State
6 scattered components: `UploadZone`, `UploadProgress`, `FileInfo`, `TypeConfirmation`, `ProcessingSpinner`, `ResultsPanel`. State in `app-store.ts` with 7 phases.

### New: 4-Step Wizard

| Step | Name | Content | Validation |
|------|------|---------|------------|
| 1 | Upload | Drag-drop zone, file validation | File selected & uploaded |
| 2 | Análise | AI analysis results, thumbnail, metadata, type suggestion | Type selected |
| 3 | Processar | Quality selector, optional crop, process button, spinner | Processing complete |
| 4 | Resultado | Before/after comparison, download, "Nova Imagem" reset | — |

### State Management

New `useReducer` in `ProcessWizard` component. Actions:
- `SET_STEP`, `SET_FILE`, `SET_ANALYSIS`, `SET_TYPE`, `SET_QUALITY`
- `SET_RESULT`, `SET_ERROR`, `RESET`

### Navigation
- Back/Next buttons per step
- "Next" disabled until step validation passes
- Completed steps clickable in stepper for back-navigation
- Auto-advance: after upload (1→2), after processing (3→4)

### Component Structure
```
ProcessWizard.tsx          — orchestrator + reducer + stepper
ProcessStepUpload.tsx      — step 1 (reuses UploadZone)
ProcessStepAnalysis.tsx    — step 2 (reuses FileInfo + type selector)
ProcessStepProcess.tsx     — step 3 (quality + crop + process)
ProcessStepResult.tsx      — step 4 (reuses ResultsPanel)
```

---

## Part 2: Gerar Imagem — Accordion Progressive Form

### Current State
`GeneratePanel.tsx` — 1200-line monolith, all inputs on one page.

### New: Collapsible Accordion Sections

| # | Section | Content | Auto-expand |
|---|---------|---------|-------------|
| 1 | Descreva a Imagem | Prompt textarea | Default expanded |
| 2 | Tipo da Imagem | Category tabs + type cards + custom mode | After prompt ≥ 10 chars |
| 3 | Qualidade | Quality tier selector + cost estimate | After type selected |
| 4 | Resultado | Image preview + download + "Nova Geração" | After generation |

### Key Difference from Wizard
All sections always visible (collapsed or expanded). Users click any section header to toggle. No "Next" buttons. Step indicator shows completion but doesn't enforce order.

### Section Header
Shows: step number, title, completion badge (checkmark), collapsed summary (e.g. "Favicon · 128×128").

### State Management
Keep existing `generation-store`. Add local `expandedSections` state. No reducer needed.

### Component Structure
```
GenerateAccordion.tsx          — orchestrator
GenerateAccordionSection.tsx   — reusable section wrapper
GenerateSectionPrompt.tsx      — section 1
GenerateSectionType.tsx        — section 2
GenerateSectionQuality.tsx     — section 3
GenerateSectionResult.tsx      — section 4
```

---

## Part 3: Shared — WizardStepper Component

Reusable horizontal step indicator for both flows.

### Props
```ts
type Props = {
  steps: { label: string }[];
  currentStep: number;
  onStepClick?: (step: number) => void;  // omit for indicator-only mode
};
```

### Visual States
- Completed: filled circle + checkmark, clickable (if onStepClick provided)
- Current: highlighted circle + step number, `aria-current="step"`
- Future: outlined circle, non-interactive
- Connecting lines: solid (completed) / dashed (incomplete)

---

## Testing Strategy

| Component | Tests |
|-----------|-------|
| `WizardStepper` | Renders steps, highlights current, completed clickable, future disabled |
| `ProcessWizard` reducer | All state transitions, auto-advance, reset |
| `ProcessStepUpload` | File validation, upload trigger |
| `ProcessStepAnalysis` | Displays analysis, type selection |
| `GenerateAccordionSection` | Expand/collapse, summary display |
| `GenerateAccordion` | Auto-expand logic, section completion badges |

## Reference
- Crochet-tryon wizard pattern: `useReducer` + step components + progress stepper
- Research: NN/G wizards, PatternFly progressive forms, Squoosh single-page model
