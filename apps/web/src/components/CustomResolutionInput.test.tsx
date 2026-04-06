import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CustomResolutionInput } from "./CustomResolutionInput";

describe("CustomResolutionInput", () => {
  it("renders width and height inputs", () => {
    render(<CustomResolutionInput width={null} height={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Largura (px)")).toBeInTheDocument();
    expect(screen.getByLabelText("Altura (px)")).toBeInTheDocument();
  });

  it("displays current dimensions in inputs", () => {
    render(<CustomResolutionInput width={1920} height={1080} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Largura (px)")).toHaveValue(1920);
    expect(screen.getByLabelText("Altura (px)")).toHaveValue(1080);
  });

  it("calls onChange when both dimensions are valid", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CustomResolutionInput width={null} height={null} onChange={onChange} />);

    await user.type(screen.getByLabelText("Largura (px)"), "1920");
    await user.type(screen.getByLabelText("Altura (px)"), "1080");

    expect(onChange).toHaveBeenCalledWith(1920, 1080);
  });

  it("shows error for dimensions below minimum", async () => {
    const user = userEvent.setup();
    render(<CustomResolutionInput width={null} height={null} onChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Largura (px)"), "8");
    await user.type(screen.getByLabelText("Altura (px)"), "100");

    expect(screen.getByText(/mínima/i)).toBeInTheDocument();
  });

  it("shows megapixel count when dimensions set", () => {
    render(<CustomResolutionInput width={1920} height={1080} onChange={vi.fn()} />);
    expect(screen.getByText(/2\.1\s*MP/i)).toBeInTheDocument();
  });

  it("shows aspect ratio when dimensions set", () => {
    render(<CustomResolutionInput width={1920} height={1080} onChange={vi.fn()} />);
    expect(screen.getByText("16:9")).toBeInTheDocument();
  });

  it("swaps dimensions when swap button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CustomResolutionInput width={1920} height={1080} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /trocar/i }));
    expect(onChange).toHaveBeenCalledWith(1080, 1920);
  });
});
