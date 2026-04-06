import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { useGenerationStore } from "@/stores/generation-store";
import { GenerateSectionPrompt } from "./GenerateSectionPrompt";

describe("GenerateSectionPrompt", () => {
  beforeEach(() => {
    useGenerationStore.setState({
      prompt: "",
      step: "idle",
      moderation: null,
    });
  });

  it("renders prompt textarea", () => {
    render(<GenerateSectionPrompt />);
    expect(
      screen.getByPlaceholderText(/Descreva a imagem que deseja gerar/i),
    ).toBeInTheDocument();
  });

  it("displays the current prompt from the store", () => {
    useGenerationStore.setState({ prompt: "A colorful illustration" });
    render(<GenerateSectionPrompt />);
    expect(screen.getByDisplayValue("A colorful illustration")).toBeInTheDocument();
  });

  it("updates store when user types", async () => {
    const user = userEvent.setup();
    render(<GenerateSectionPrompt />);
    const textarea = screen.getByPlaceholderText(/Descreva a imagem que deseja gerar/i);
    await user.type(textarea, "Hello");
    expect(useGenerationStore.getState().prompt).toBe("Hello");
  });

  it("shows remaining character hint when prompt is between 1 and 9 chars", () => {
    useGenerationStore.setState({ prompt: "short" });
    render(<GenerateSectionPrompt />);
    expect(screen.getByText(/5 caracteres restantes/i)).toBeInTheDocument();
  });

  it("does not show remaining character hint when prompt is empty", () => {
    useGenerationStore.setState({ prompt: "" });
    render(<GenerateSectionPrompt />);
    expect(screen.queryByText(/caracteres restantes/i)).not.toBeInTheDocument();
  });

  it("does not show remaining character hint when prompt is >= 10 chars", () => {
    useGenerationStore.setState({ prompt: "long enough" });
    render(<GenerateSectionPrompt />);
    expect(screen.queryByText(/caracteres restantes/i)).not.toBeInTheDocument();
  });
});
