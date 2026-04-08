import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ImageResultCard } from "./ImageResultCard";

vi.mock("@/hooks/useAuthImage", () => ({
  useAuthImage: (url: string | null) => ({
    src: url ? `blob:test/${url}` : null,
    loading: false,
  }),
}));

const defaultProps = {
  original: {
    url: "blob://original",
    width: 1920,
    height: 1080,
    sizeKb: 450,
  },
  processed: {
    url: "/api/v1/images/upload-1/download",
    width: 800,
    height: 600,
    sizeKb: 120,
  },
  adjustments: ["resized", "compressed"],
  explanation: "A imagem foi redimensionada e comprimida com sucesso.",
};

describe("ImageResultCard", () => {
  it("renders before/after comparison images", () => {
    render(<ImageResultCard {...defaultProps} />);
    expect(screen.getByAltText("Original")).toBeInTheDocument();
    expect(screen.getByAltText("Processada")).toBeInTheDocument();
  });

  it("renders ANTES and DEPOIS labels", () => {
    render(<ImageResultCard {...defaultProps} />);
    expect(screen.getByText("ANTES")).toBeInTheDocument();
    expect(screen.getByText("DEPOIS")).toBeInTheDocument();
  });

  it("shows original and processed dimensions", () => {
    render(<ImageResultCard {...defaultProps} />);
    expect(screen.getByText(/1920x1080/)).toBeInTheDocument();
    expect(screen.getByText(/800x600/)).toBeInTheDocument();
  });

  it("shows size reduction percentage", () => {
    render(<ImageResultCard {...defaultProps} />);
    // 1 - 120/450 = ~73%
    expect(screen.getByText(/-73%/)).toBeInTheDocument();
  });

  it("shows original and processed file sizes", () => {
    render(<ImageResultCard {...defaultProps} />);
    expect(screen.getByText("450 KB")).toBeInTheDocument();
    expect(screen.getByText("120 KB")).toBeInTheDocument();
  });

  it("renders adjustment badges", () => {
    render(<ImageResultCard {...defaultProps} />);
    expect(screen.getByText(/Resize/i)).toBeInTheDocument();
    expect(screen.getByText(/Compress/i)).toBeInTheDocument();
  });

  it("renders AI explanation", () => {
    render(<ImageResultCard {...defaultProps} />);
    expect(
      screen.getByText("A imagem foi redimensionada e comprimida com sucesso."),
    ).toBeInTheDocument();
  });

  it("does not render explanation when null", () => {
    render(<ImageResultCard {...defaultProps} explanation={null} />);
    expect(
      screen.queryByText("Relatório da Assistente IA"),
    ).not.toBeInTheDocument();
  });

  it("renders user_cropped adjustment with Portuguese label", () => {
    render(
      <ImageResultCard
        {...defaultProps}
        adjustments={["user_cropped", "resized"]}
      />,
    );
    expect(screen.getByText("Recortado pelo Usuário")).toBeInTheDocument();
    expect(screen.getByText("User_Cropped")).toBeInTheDocument();
  });

  it("does not render badges when adjustments are empty", () => {
    render(<ImageResultCard {...defaultProps} adjustments={[]} />);
    expect(screen.queryByText(/Resize/i)).not.toBeInTheDocument();
  });

  it("shows green badge for size reduction", () => {
    render(<ImageResultCard {...defaultProps} />);
    // 1 - 120/450 = ~73%
    const badge = screen.getByText("-73%");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("emerald");
  });

  it("shows red badge with plus sign for size increase", () => {
    render(
      <ImageResultCard
        {...defaultProps}
        processed={{ ...defaultProps.processed, sizeKb: 500 }}
      />,
    );
    // 1 - 500/450 ≈ -11% → should display as +11% increase with red badge
    const badge = screen.getByText("+11%");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("red");
  });

  // --- Lightbox ---

  it("opens lightbox at ANTES when clicking original thumbnail", async () => {
    const user = userEvent.setup();
    render(<ImageResultCard {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /original/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("ANTES").length).toBeGreaterThanOrEqual(2);
  });

  it("opens lightbox at DEPOIS when clicking processed thumbnail", async () => {
    const user = userEvent.setup();
    render(<ImageResultCard {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /processada/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("DEPOIS").length).toBeGreaterThanOrEqual(2);
  });

  it("closes lightbox when close is triggered", async () => {
    const user = userEvent.setup();
    render(<ImageResultCard {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /original/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
