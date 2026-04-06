import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { StyleSelector } from "./StyleSelector";

describe("StyleSelector", () => {
  it("renders four style options", () => {
    render(<StyleSelector selected="auto" onSelect={vi.fn()} />);
    expect(screen.getByText("Automático")).toBeInTheDocument();
    expect(screen.getByText("Ilustração")).toBeInTheDocument();
    expect(screen.getByText("Fotorrealista")).toBeInTheDocument();
    expect(screen.getByText("Logo")).toBeInTheDocument();
  });

  it("calls onSelect when a style is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<StyleSelector selected="auto" onSelect={onSelect} />);

    await user.click(screen.getByText("Fotorrealista"));
    expect(onSelect).toHaveBeenCalledWith("photorealistic");
  });

  it("highlights the selected style", () => {
    render(<StyleSelector selected="photorealistic" onSelect={vi.fn()} />);
    const btn = screen.getByText("Fotorrealista").closest("button");
    expect(btn?.className).toContain("border-primary");
  });

  it("does not highlight non-selected styles", () => {
    render(<StyleSelector selected="photorealistic" onSelect={vi.fn()} />);
    const btn = screen.getByText("Logo").closest("button");
    expect(btn?.className).not.toContain("border-primary");
  });

  it("shows model subtitles", () => {
    render(<StyleSelector selected="auto" onSelect={vi.fn()} />);
    expect(screen.getAllByText("Recraft V3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("FLUX.2 Pro")).toBeInTheDocument();
  });
});
