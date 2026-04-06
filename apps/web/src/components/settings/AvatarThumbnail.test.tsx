import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AvatarThumbnail } from "./AvatarThumbnail";

describe("AvatarThumbnail", () => {
  const defaultProps = {
    id: "av-1",
    url: "/api/v1/avatar/av-1",
    isCurrent: false,
    isSelected: false,
    isMultiSelect: false,
    onSelect: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders the avatar image", () => {
    render(<AvatarThumbnail {...defaultProps} />);
    expect(screen.getByAltText("Avatar av-1")).toBeInTheDocument();
  });

  it("shows a ring when selected", () => {
    const { container } = render(<AvatarThumbnail {...defaultProps} isSelected />);
    expect(container.querySelector("[data-selected='true']")).toBeInTheDocument();
  });

  it("shows a ring when current", () => {
    const { container } = render(<AvatarThumbnail {...defaultProps} isCurrent />);
    expect(container.querySelector("[data-current='true']")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AvatarThumbnail {...defaultProps} onSelect={onSelect} />);
    await user.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("av-1");
  });

  it("shows delete button on hover for non-current thumbnails", async () => {
    const user = userEvent.setup();
    render(<AvatarThumbnail {...defaultProps} />);
    const button = screen.getByRole("button");
    await user.hover(button);
    expect(screen.getByLabelText("Excluir avatar")).toBeInTheDocument();
  });

  it("shows checkbox in multi-select mode", () => {
    render(<AvatarThumbnail {...defaultProps} isMultiSelect />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
});
