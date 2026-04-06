import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SettingsPage } from "./SettingsPage";

vi.mock("@/lib/api", () => ({
  fetchAvatarHistory: vi.fn(() => Promise.resolve([])),
  uploadAvatar: vi.fn(),
  restoreAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  bulkDeleteAvatars: vi.fn(),
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

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

vi.mock("@/stores/theme-store", () => ({
  useThemeStore: (selector: (s: { theme: string; toggleTheme: () => void }) => unknown) =>
    selector({ theme: "dark", toggleTheme: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    changePassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    listAccounts: vi.fn().mockResolvedValue({ data: [], error: null }),
    listSessions: vi.fn().mockResolvedValue({ data: [], error: null }),
    revokeOtherSessions: vi.fn().mockResolvedValue({ data: {}, error: null }),
    deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    linkSocial: vi.fn().mockResolvedValue({ data: {}, error: null }),
    unlinkAccount: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
  useSession: vi.fn().mockReturnValue({
    data: { session: { token: "test-token" } },
    isPending: false,
  }),
  signOut: vi.fn(),
}));

const session = {
  user: {
    name: "Gabriel",
    email: "gabriel@woli.com",
    emailVerified: true,
    image: null,
    username: "gabriel",
  },
};

describe("SettingsPage", () => {
  it("renders the page title", () => {
    render(<SettingsPage session={session} />, { wrapper: createWrapper() });
    expect(screen.getByText("Configurações")).toBeInTheDocument();
  });

  it("renders all 5 card headings", () => {
    render(<SettingsPage session={session} />, { wrapper: createWrapper() });
    expect(screen.getByText("Perfil")).toBeInTheDocument();
    expect(screen.getByText("Segurança")).toBeInTheDocument();
    expect(screen.getByText("Sessões Ativas")).toBeInTheDocument();
    expect(screen.getByText("Aparência")).toBeInTheDocument();
    expect(screen.getByText("Zona de Perigo")).toBeInTheDocument();
  });
});
