import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import type { HistoryItem } from "@/lib/api";

vi.mock("@/hooks/useAuthImage", () => ({
  useAuthImage: (url: string | null) => ({
    src: url ? `blob:test/${url}` : null,
    loading: false,
  }),
}));

vi.mock("@/lib/auth-download", () => ({
  downloadAuthFile: vi.fn().mockResolvedValue(undefined),
}));

const genItem: HistoryItem = {
  id: "gen-1",
  mode: "generation",
  status: "completed",
  createdAt: "2026-04-05T10:30:00Z",
  thumbnailUrl: "/api/v1/history/gen-1/thumbnail?mode=generation",
  downloadUrl: "/api/v1/generate/gen-1/download",
  category: "admin",
  imageTypeName: "Favicon",
  finalWidth: 256,
  finalHeight: 256,
  finalFormat: "png",
  finalSizeKb: 42,
  prompt: "A colorful owl mascot",
  enhancedPrompt: "A vibrant colorful owl",
  model: "recraft_v3",
  qualityTier: "high",
  costUsd: 0.04,
  originalFilename: null,
  originalWidth: null,
  originalHeight: null,
  originalSizeKb: null,
  aiQualityScore: null,
};

const uploadItem: HistoryItem = {
  id: "upl-1",
  mode: "upload",
  status: "completed",
  createdAt: "2026-04-05T09:00:00Z",
  thumbnailUrl: "/api/v1/history/upl-1/thumbnail?mode=upload",
  downloadUrl: "/api/v1/images/upl-1/download",
  category: "user",
  imageTypeName: "Avatar",
  finalWidth: 128,
  finalHeight: 128,
  finalFormat: "jpeg",
  finalSizeKb: 30,
  prompt: null,
  enhancedPrompt: null,
  model: null,
  qualityTier: null,
  costUsd: null,
  originalFilename: "photo.jpg",
  originalWidth: 1200,
  originalHeight: 800,
  originalSizeKb: 480,
  aiQualityScore: 8,
};

function renderPanel(item: HistoryItem, overrides: Partial<Parameters<typeof HistoryDetailPanel>[0]> = {}) {
  return render(
    <HistoryDetailPanel
      item={item}
      onClose={overrides.onClose ?? vi.fn()}
      onOpenLightbox={overrides.onOpenLightbox ?? vi.fn()}
      onDelete={overrides.onDelete ?? vi.fn()}
      onRegenerate={overrides.onRegenerate ?? vi.fn()}
    />,
  );
}

describe("HistoryDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows generation metadata (Favicon, Recraft V3, prompt text)", () => {
    renderPanel(genItem);

    // Favicon appears in header title and in Tipo metadata row
    expect(screen.getAllByText("Favicon")).toHaveLength(2);
    expect(screen.getByText("Recraft V3")).toBeInTheDocument();
    // PRICING_HIDDEN: cost display removed for demo
    // expect(screen.getByText("$0.040")).toBeInTheDocument();
    expect(screen.getByText("A colorful owl mascot")).toBeInTheDocument();
  });

  it("shows upload metadata (Avatar, photo.jpg, before→after dimensions)", () => {
    renderPanel(uploadItem);

    // Avatar appears in header title and in Tipo metadata row
    expect(screen.getAllByText("Avatar")).toHaveLength(2);
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    expect(screen.getByText(/1200×800\s+480KB\s*→\s*128×128\s+30KB/)).toBeInTheDocument();
  });

  it("hides model/prompt for uploads", () => {
    renderPanel(uploadItem);

    expect(screen.queryByText("Recraft V3")).not.toBeInTheDocument();
    // PRICING_HIDDEN: cost display removed for demo
    // expect(screen.queryByText("$0.040")).not.toBeInTheDocument();
    expect(screen.queryByText("Prompt")).not.toBeInTheDocument();
  });

  it("hides filename/before-after for generations", () => {
    renderPanel(genItem);

    expect(screen.queryByText("photo.jpg")).not.toBeInTheDocument();
    expect(screen.queryByText(/Antes → Depois/)).not.toBeInTheDocument();
  });

  it("close button calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPanel(genItem, { onClose });

    await user.click(screen.getByRole("button", { name: "Fechar painel" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("delete button calls onDelete", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderPanel(genItem, { onDelete });

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('image preview click calls onOpenLightbox("single")', async () => {
    const user = userEvent.setup();
    const onOpenLightbox = vi.fn();
    renderPanel(genItem, { onOpenLightbox });

    await user.click(screen.getByRole("button", { name: "Ampliar imagem" }));
    expect(onOpenLightbox).toHaveBeenCalledWith("single");
  });

  it("re-gerar button shown for generation, hidden for upload", () => {
    const { unmount } = renderPanel(genItem);
    expect(screen.getByRole("button", { name: "Re-gerar" })).toBeInTheDocument();
    unmount();

    renderPanel(uploadItem);
    expect(screen.queryByRole("button", { name: "Re-gerar" })).not.toBeInTheDocument();
  });

  it("compare button NOT shown for upload or generation", () => {
    const { unmount } = renderPanel(uploadItem);
    expect(screen.queryByText("Comparar")).not.toBeInTheDocument();
    unmount();

    renderPanel(genItem);
    expect(screen.queryByText("Comparar")).not.toBeInTheDocument();
  });

  describe("FormatSelector", () => {
    it("renders format selector with JPEG, PNG, WebP options", () => {
      renderPanel(genItem);

      expect(screen.getByRole("group", { name: "Formato de download" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "JPEG" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "PNG" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "WebP" })).toBeInTheDocument();
    });

    it("defaults to the item's finalFormat", () => {
      // genItem.finalFormat is "png" — the PNG button should have the active style
      renderPanel(genItem);
      const pngButton = screen.getByRole("button", { name: "PNG" });
      expect(pngButton.className).toContain("bg-primary");
    });

    it("defaults to jpeg for items with jpg format", () => {
      const jpgItem = { ...uploadItem, finalFormat: "jpg" };
      renderPanel(jpgItem);
      const jpegButton = screen.getByRole("button", { name: "JPEG" });
      expect(jpegButton.className).toContain("bg-primary");
    });

    it("includes ?format= in the download URL with selected format", async () => {
      const { downloadAuthFile } = await import("@/lib/auth-download");
      vi.mocked(downloadAuthFile).mockResolvedValue(undefined);

      const user = userEvent.setup();
      renderPanel(genItem);

      await user.click(screen.getByRole("button", { name: "Download" }));

      expect(downloadAuthFile).toHaveBeenCalledWith(
        expect.stringContaining("?format=png"),
        expect.stringContaining(".png"),
      );
    });

    it("uses selected format when changed from default", async () => {
      const { downloadAuthFile } = await import("@/lib/auth-download");
      vi.mocked(downloadAuthFile).mockResolvedValue(undefined);

      const user = userEvent.setup();
      renderPanel(genItem);

      // Switch to WebP
      await user.click(screen.getByRole("button", { name: "WebP" }));
      await user.click(screen.getByRole("button", { name: "Download" }));

      expect(downloadAuthFile).toHaveBeenCalledWith(
        expect.stringContaining("?format=webp"),
        expect.stringContaining(".webp"),
      );
    });

    it("strips existing extension from displayName before appending format", async () => {
      const { downloadAuthFile } = await import("@/lib/auth-download");
      vi.mocked(downloadAuthFile).mockResolvedValue(undefined);

      const itemWithExt = { ...genItem, displayName: "generated-851a0d7c.png" };
      const user = userEvent.setup();
      renderPanel(itemWithExt);

      // Switch to JPEG and download
      await user.click(screen.getByRole("button", { name: "JPEG" }));
      await user.click(screen.getByRole("button", { name: "Download" }));

      expect(downloadAuthFile).toHaveBeenCalledWith(
        expect.any(String),
        "generated-851a0d7c.jpg",
      );
    });

    it("uses .jpg extension for jpeg format in filename", async () => {
      const { downloadAuthFile } = await import("@/lib/auth-download");
      vi.mocked(downloadAuthFile).mockResolvedValue(undefined);

      const user = userEvent.setup();
      renderPanel(genItem);

      // Switch to JPEG
      await user.click(screen.getByRole("button", { name: "JPEG" }));
      await user.click(screen.getByRole("button", { name: "Download" }));

      expect(downloadAuthFile).toHaveBeenCalledWith(
        expect.stringContaining("?format=jpeg"),
        expect.stringContaining(".jpg"),
      );
    });
  });
});
