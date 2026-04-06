import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import type { HistoryItem } from "@/lib/api";

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
  it("shows generation metadata (Favicon, Recraft V3, cost $0.040, prompt text)", () => {
    renderPanel(genItem);

    // Favicon appears in header title and in Tipo metadata row
    expect(screen.getAllByText("Favicon")).toHaveLength(2);
    expect(screen.getByText("Recraft V3")).toBeInTheDocument();
    expect(screen.getByText("$0.040")).toBeInTheDocument();
    expect(screen.getByText("A colorful owl mascot")).toBeInTheDocument();
  });

  it("shows upload metadata (Avatar, photo.jpg, before→after dimensions)", () => {
    renderPanel(uploadItem);

    // Avatar appears in header title and in Tipo metadata row
    expect(screen.getAllByText("Avatar")).toHaveLength(2);
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    expect(screen.getByText(/1200×800\s+480KB\s*→\s*128×128\s+30KB/)).toBeInTheDocument();
  });

  it("hides model/cost/prompt for uploads", () => {
    renderPanel(uploadItem);

    expect(screen.queryByText("Recraft V3")).not.toBeInTheDocument();
    expect(screen.queryByText("$0.040")).not.toBeInTheDocument();
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

  it("compare button shown for upload, hidden for generation", () => {
    const { unmount } = renderPanel(uploadItem);
    expect(screen.getByText("Comparar")).toBeInTheDocument();
    unmount();

    renderPanel(genItem);
    expect(screen.queryByText("Comparar")).not.toBeInTheDocument();
  });
});
