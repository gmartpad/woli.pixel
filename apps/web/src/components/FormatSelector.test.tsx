import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FormatSelector } from "./FormatSelector";

describe("FormatSelector", () => {
  it("renders JPEG, PNG, WebP buttons", () => {
    render(<FormatSelector selected="jpeg" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "JPEG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PNG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WebP" })).toBeInTheDocument();
  });

  it("highlights the selected format", () => {
    render(<FormatSelector selected="png" onChange={vi.fn()} />);
    const pngButton = screen.getByRole("button", { name: "PNG" });
    expect(pngButton.className).toContain("bg-primary");
  });

  it("does not highlight unselected formats", () => {
    render(<FormatSelector selected="png" onChange={vi.fn()} />);
    const jpegButton = screen.getByRole("button", { name: "JPEG" });
    expect(jpegButton.className).not.toContain("bg-primary");
  });

  it("calls onChange with format value when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormatSelector selected="jpeg" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "WebP" }));
    expect(onChange).toHaveBeenCalledWith("webp");
  });

  it("calls onChange with jpeg when JPEG clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormatSelector selected="png" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "JPEG" }));
    expect(onChange).toHaveBeenCalledWith("jpeg");
  });
});
