import { formatSize } from "@/lib/format";
import { processImage } from "@/lib/api";
import { TypeSelector } from "./TypeSelector";
import type { ProcessWizardState, ProcessWizardAction } from "./process-wizard-reducer";

type Props = {
  state: ProcessWizardState;
  dispatch: React.Dispatch<ProcessWizardAction>;
};

export function ProcessStepAnalysis({ state, dispatch }: Props) {
  const handleProcess = async () => {
    if (!state.uploadId || !state.selectedTypeId) return;

    dispatch({ type: "SET_PROCESSING", value: true });

    try {
      const result = await processImage(state.uploadId, state.selectedTypeId);
      dispatch({ type: "SET_RESULT", result });
      dispatch({ type: "SET_STEP", step: 2 });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Erro no processamento",
      });
    }
  };

  if (state.isProcessing) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-xl py-12">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_20px_rgba(133,173,255,0.3)]" />
        <p className="text-lg font-semibold text-primary font-headline">
          Processando imagem...
        </p>
        <p className="text-sm text-on-surface-variant">
          Redimensionando, convertendo e otimizando
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Image Info Card */}
      {state.originalImage && (
        <div className="glass-card rounded-xl p-6">
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6">
            {/* Thumbnail */}
            <div className="w-full sm:w-40">
              <div className="overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container/60">
                <img
                  src={state.originalImage.url}
                  alt={state.originalImage.filename}
                  className="h-40 w-full object-contain"
                />
              </div>
            </div>

            {/* Metadata */}
            <div className="min-w-0 space-y-3">
              <h3 className="text-lg font-bold font-headline text-on-surface truncate">
                {state.originalImage.filename}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-on-surface-variant">Dimensões</span>
                  <p className="font-mono text-on-surface">
                    {state.originalImage.width} x {state.originalImage.height} px
                  </p>
                </div>
                <div>
                  <span className="text-on-surface-variant">Tamanho</span>
                  <p className="font-mono text-on-surface">
                    {formatSize(state.originalImage.sizeKb)}
                  </p>
                </div>
                <div>
                  <span className="text-on-surface-variant">Formato</span>
                  <p className="font-mono text-on-surface uppercase">
                    {state.originalImage.format}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Card */}
      {state.analysis && (
        <div className="glass-card rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-dim text-[10px] font-bold text-white shadow-[0_0_8px_rgba(133,173,255,0.3)]">
              AI
            </span>
            <h4 className="text-sm font-semibold text-on-surface font-headline">
              Análise Inteligente
            </h4>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-on-surface-variant">Qualidade</span>
              <p className="text-xl font-bold text-primary">
                {state.analysis.qualityScore ?? "—"}
              </p>
            </div>
            <div>
              <span className="text-on-surface-variant">Conteúdo</span>
              <p className="font-medium text-on-surface">
                {state.analysis.contentType ?? "—"}
              </p>
            </div>
            <div>
              <span className="text-on-surface-variant">Tipo Sugerido</span>
              <p className="font-medium text-primary">
                {state.analysis.suggestedTypeName ?? "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Type Selection */}
      <TypeSelector
        selectedTypeId={state.selectedTypeId}
        onSelectType={(typeId) => dispatch({ type: "SET_TYPE", typeId })}
      />

      {/* Error State */}
      {state.error && (
        <div className="glass-card flex flex-col items-center justify-center rounded-xl py-6 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error-container/30">
            <svg
              className="h-5 w-5 text-error"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-sm text-error">{state.error}</p>
          <button
            onClick={handleProcess}
            className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <button
          onClick={() => dispatch({ type: "SET_STEP", step: 0 })}
          className="rounded-xl border border-outline-variant/30 px-6 py-3 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={handleProcess}
          disabled={!state.selectedTypeId || state.isProcessing}
          className="flex-1 rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-3 text-lg font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
        >
          Processar Imagem
        </button>
      </div>
    </div>
  );
}
