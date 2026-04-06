import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AvatarHistoryGrid } from "./AvatarHistoryGrid";

const mockAvatars = [
  { id: "av-1", url: "/api/v1/avatar/av-1", uploadedAt: "2026-04-01T00:00:00Z", fileSize: 2048 },
  { id: "av-2", url: "/api/v1/avatar/av-2", uploadedAt: "2026-04-02T00:00:00Z", fileSize: 3072 },
  { id: "av-3", url: "/api/v1/avatar/av-3", uploadedAt: "2026-04-03T00:00:00Z", fileSize: 1024 },
];

describe("AvatarHistoryGrid", () => {
  const defaultProps = {
    avatars: mockAvatars,
    currentAvatarId: "av-1",
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onBulkDelete: vi.fn(),
    isLoading: false,
  };

  it("renders all avatar thumbnails", () => {
    render(<AvatarHistoryGrid {...defaultProps} />);
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(3);
  });

  it("shows empty state when no avatars", () => {
    render(<AvatarHistoryGrid {...defaultProps} avatars={[]} />);
    expect(screen.getByText(/nenhuma foto/i)).toBeInTheDocument();
  });

  it("shows footer with count", () => {
    render(<AvatarHistoryGrid {...defaultProps} />);
    expect(screen.getByText(/3 fotos/i)).toBeInTheDocument();
  });

  it("toggles multi-select mode", async () => {
    const user = userEvent.setup();
    render(<AvatarHistoryGrid {...defaultProps} />);

    const toggleBtn = screen.getByText(/selecionar/i);
    await user.click(toggleBtn);

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("shows bulk delete button with count in multi-select mode", async () => {
    const user = userEvent.setup();
    const onBulkDelete = vi.fn();
    render(<AvatarHistoryGrid {...defaultProps} onBulkDelete={onBulkDelete} />);

    // Enter multi-select mode
    await user.click(screen.getByText(/selecionar/i));

    // Select two thumbnails
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    // Bulk delete button should show count
    expect(screen.getByText(/excluir selecionados/i)).toBeInTheDocument();
  });
});
