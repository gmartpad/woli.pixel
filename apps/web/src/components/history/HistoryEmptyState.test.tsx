import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryEmptyState } from "./HistoryEmptyState";

describe("HistoryEmptyState", () => {
  describe("first-use variant", () => {
    it("renders heading and CTA link", () => {
      render(<HistoryEmptyState variant="first-use" />);

      expect(
        screen.getByText("Nenhuma imagem no histórico"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Gere ou processe sua primeira imagem para vê-la aqui.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Gerar Imagem")).toBeInTheDocument();
    });
  });

  describe("no-results variant", () => {
    it("renders heading and clicking 'Limpar Filtros' calls onClearFilters", async () => {
      const user = userEvent.setup();
      const onClearFilters = vi.fn();

      render(
        <HistoryEmptyState
          variant="no-results"
          onClearFilters={onClearFilters}
        />,
      );

      expect(
        screen.getByText("Nenhum resultado encontrado"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Tente ajustar seus filtros ou limpar a busca."),
      ).toBeInTheDocument();

      await user.click(screen.getByText("Limpar Filtros"));
      expect(onClearFilters).toHaveBeenCalledOnce();
    });
  });

  describe("error variant", () => {
    it("renders error message and clicking 'Tentar Novamente' calls onRetry", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();

      render(
        <HistoryEmptyState
          variant="error"
          errorMessage="Falha na conexão com o servidor"
          onRetry={onRetry}
        />,
      );

      expect(
        screen.getByText("Erro ao carregar histórico"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Falha na conexão com o servidor"),
      ).toBeInTheDocument();

      await user.click(screen.getByText("Tentar Novamente"));
      expect(onRetry).toHaveBeenCalledOnce();
    });
  });
});
