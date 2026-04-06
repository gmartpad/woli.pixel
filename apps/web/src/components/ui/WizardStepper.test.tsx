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
    const upload = screen.getByText("Upload");
    expect(upload.closest("button")).toBeNull();
  });
});
