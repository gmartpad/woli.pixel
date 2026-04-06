import { useReducer } from "react";
import { WizardStepper } from "@/components/ui/WizardStepper";
import { processWizardReducer, initialState } from "./process-wizard-reducer";
import { ProcessStepUpload } from "./ProcessStepUpload";
import { ProcessStepAnalysis } from "./ProcessStepAnalysis";
import { ProcessStepResult } from "./ProcessStepResult";
import { BatchStepAnalysis } from "./BatchStepAnalysis";
import { BatchStepResult } from "./BatchStepResult";

const STEPS = [
  { label: "Upload" },
  { label: "Análise" },
  { label: "Resultado" },
];

export function ProcessWizard() {
  const [state, dispatch] = useReducer(processWizardReducer, initialState);
  const steps = STEPS;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">
          Curadoria de Imagens por IA
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Valide, redimensione e otimize seus ativos visuais com precisão
          cirúrgica.
        </p>
      </div>

      <WizardStepper
        steps={steps}
        currentStep={state.step}
        onStepClick={(step) =>
          dispatch({ type: "SET_STEP", step: step as 0 | 1 | 2 })
        }
      />

      {state.step === 0 && (
        <ProcessStepUpload state={state} dispatch={dispatch} />
      )}

      {state.step === 1 && state.mode === "single" && (
        <ProcessStepAnalysis state={state} dispatch={dispatch} />
      )}
      {state.step === 1 && state.mode === "batch" && (
        <BatchStepAnalysis dispatch={dispatch} />
      )}

      {state.step === 2 && state.mode === "single" && (
        <ProcessStepResult state={state} dispatch={dispatch} />
      )}
      {state.step === 2 && state.mode === "batch" && (
        <BatchStepResult dispatch={dispatch} />
      )}
    </div>
  );
}
