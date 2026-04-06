import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GenerateAccordionSection } from "./GenerateAccordionSection";

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
        <p>content inside</p>
      </GenerateAccordionSection>,
    );
    expect(screen.getByText("Descreva a Imagem")).toBeInTheDocument();
    expect(screen.getByText("content inside")).toBeInTheDocument();
  });

  it("shows completion badge when isComplete is true", () => {
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
      </GenerateAccordionSection>,
    );
    expect(screen.getByTestId("completion-badge")).toBeInTheDocument();
  });

  it("shows summary text when collapsed and isComplete", () => {
    render(
      <GenerateAccordionSection
        stepNumber={2}
        title="Tipo"
        isExpanded={false}
        isComplete={true}
        onToggle={vi.fn()}
        summary="Favicon · 128×128"
      >
        <p>content</p>
      </GenerateAccordionSection>,
    );
    expect(screen.getByText(/Favicon · 128×128/)).toBeInTheDocument();
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
      </GenerateAccordionSection>,
    );
    await user.click(screen.getByText("Prompt"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("does not show completion badge when isComplete is false", () => {
    render(
      <GenerateAccordionSection
        stepNumber={1}
        title="Prompt"
        isExpanded={true}
        isComplete={false}
        onToggle={vi.fn()}
      >
        <p>content</p>
      </GenerateAccordionSection>,
    );
    expect(screen.queryByTestId("completion-badge")).not.toBeInTheDocument();
  });
});
