import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AvatarPickerModal } from "./AvatarPickerModal";

vi.mock("@/lib/api", () => ({
  fetchAvatarHistory: vi.fn(() => Promise.resolve([])),
  restoreAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  bulkDeleteAvatars: vi.fn(),
  uploadAvatar: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { $store: { notify: vi.fn() } },
}));

vi.mock("react-easy-crop", () => ({
  __esModule: true,
  default: () => <div data-testid="mock-cropper" />,
}));

vi.mock("@/lib/crop-image", () => ({
  getCroppedImg: vi.fn(() => Promise.resolve(new Blob())),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("AvatarPickerModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    currentAvatarId: null as string | null,
    session: {
      user: { name: "Gabriel", email: "gabriel@woli.com", image: null as string | null | undefined },
    },
  };

  it("renders with History tab active by default", () => {
    render(<AvatarPickerModal {...defaultProps} />, { wrapper: createWrapper() });
    expect(screen.getByText("Alterar foto de perfil")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /histórico/i })).toHaveAttribute("aria-selected", "true");
  });

  it("switches to Upload tab when clicked", async () => {
    const user = userEvent.setup();
    render(<AvatarPickerModal {...defaultProps} />, { wrapper: createWrapper() });
    await user.click(screen.getByRole("tab", { name: /enviar nova/i }));
    expect(screen.getByRole("tab", { name: /enviar nova/i })).toHaveAttribute("aria-selected", "true");
  });

  it("calls onClose when X button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AvatarPickerModal {...defaultProps} onClose={onClose} />, { wrapper: createWrapper() });
    await user.click(screen.getByLabelText("Fechar"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not render when isOpen is false", () => {
    render(<AvatarPickerModal {...defaultProps} isOpen={false} />, { wrapper: createWrapper() });
    expect(screen.queryByText("Alterar foto de perfil")).not.toBeInTheDocument();
  });

  it("renders dropzone with instructional text on upload tab", async () => {
    const user = userEvent.setup();
    render(<AvatarPickerModal {...defaultProps} />, { wrapper: createWrapper() });
    await user.click(screen.getByRole("tab", { name: /enviar nova/i }));
    expect(screen.getByText("Arraste uma imagem aqui")).toBeInTheDocument();
    expect(screen.getByText("ou clique para selecionar")).toBeInTheDocument();
  });

  it("dropzone has accessible role and aria-label", async () => {
    const user = userEvent.setup();
    render(<AvatarPickerModal {...defaultProps} />, { wrapper: createWrapper() });
    await user.click(screen.getByRole("tab", { name: /enviar nova/i }));
    const dropzone = screen.getByRole("button", {
      name: /zona de upload/i,
    });
    expect(dropzone).toBeInTheDocument();
    expect(dropzone).toHaveAttribute(
      "aria-label",
      "Zona de upload. Arraste uma imagem ou clique para selecionar",
    );
  });

  it("shows cropper when a valid image is dropped on the dropzone", async () => {
    const user = userEvent.setup();
    render(<AvatarPickerModal {...defaultProps} />, { wrapper: createWrapper() });
    await user.click(screen.getByRole("tab", { name: /enviar nova/i }));

    const dropzone = screen.getByRole("button", { name: /zona de upload/i });
    const file = new File(["pixels"], "avatar.png", { type: "image/png" });
    const dataTransfer = {
      files: [file],
      types: ["Files"],
    };

    fireEvent.dragOver(dropzone, { dataTransfer });
    fireEvent.drop(dropzone, { dataTransfer });

    expect(screen.getByTestId("mock-cropper")).toBeInTheDocument();
  });
});
