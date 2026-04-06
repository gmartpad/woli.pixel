import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api", () => ({
  fetchAvatarHistory: vi.fn(() => Promise.resolve([])),
  uploadAvatar: vi.fn(),
  restoreAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  bulkDeleteAvatars: vi.fn(),
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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { AvatarUpload } from "./AvatarUpload";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const sessionWithImage = {
  user: {
    name: "Gabriel Padoin",
    email: "gabriel@woli.com",
    image: "/api/v1/avatar/av-123",
  },
};

const sessionWithoutImage = {
  user: {
    name: "Gabriel Padoin",
    email: "gabriel@woli.com",
    image: null as string | null,
  },
};

describe("AvatarUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders avatar image with onLoad gate", () => {
    render(<AvatarUpload session={sessionWithImage} />, { wrapper: createWrapper() });

    const img = screen.getByAltText("Avatar");
    expect(img).toBeInTheDocument();

    // Before onLoad, initials should be visible
    expect(screen.getByText("GA")).toBeInTheDocument();

    // After onLoad, initials should be gone
    fireEvent.load(img);
    expect(screen.queryByText("GA")).not.toBeInTheDocument();
  });

  it("renders initials when no image is set", () => {
    render(<AvatarUpload session={sessionWithoutImage} />, { wrapper: createWrapper() });

    expect(screen.queryByAltText("Avatar")).not.toBeInTheDocument();
    expect(screen.getByText("GA")).toBeInTheDocument();
  });

  it("opens AvatarPickerModal on 'Alterar foto' click", async () => {
    const user = userEvent.setup();
    render(<AvatarUpload session={sessionWithImage} />, { wrapper: createWrapper() });

    await user.click(screen.getByText("Alterar foto"));

    expect(screen.getByText("Alterar foto de perfil")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /histórico/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /enviar nova/i })).toBeInTheDocument();
  });

  it("closes modal when X is clicked", async () => {
    const user = userEvent.setup();
    render(<AvatarUpload session={sessionWithImage} />, { wrapper: createWrapper() });

    await user.click(screen.getByText("Alterar foto"));
    expect(screen.getByText("Alterar foto de perfil")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Fechar"));
    expect(screen.queryByText("Alterar foto de perfil")).not.toBeInTheDocument();
  });
});
