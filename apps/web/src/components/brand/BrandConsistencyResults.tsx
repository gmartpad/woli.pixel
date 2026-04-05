type ColorMatch = {
  image_color: string;
  closest_brand_color: string;
  distance: number;
  within_tolerance: boolean;
};

type Props = {
  score: number;
  issues: string[];
  colorMatches: ColorMatch[];
  hasForbiddenColors: boolean;
};

export function BrandConsistencyResults({ score, issues, colorMatches, hasForbiddenColors }: Props) {
  const scoreColor = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-yellow-400" : "text-error";
  const scoreBg = score >= 80 ? "bg-emerald-500/10" : score >= 50 ? "bg-yellow-500/10" : "bg-error/10";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg ${scoreBg} px-3 py-2`}>
          <span className={`text-xl font-bold ${scoreColor}`}>{score}</span>
          <span className="text-xs text-outline">/100</span>
        </div>
        <div>
          <div className="text-sm font-medium text-on-surface">Consistência de Marca</div>
          <div className="text-xs text-on-surface-variant">{score >= 80 ? "Alinhada" : score >= 50 ? "Parcial" : "Desalinhada"}</div>
        </div>
      </div>

      {colorMatches.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant">Correspondência de Cores</div>
          {colorMatches.map((match, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className="h-5 w-5 rounded border border-outline-variant/30" style={{ backgroundColor: match.image_color }} />
              <span className="text-outline">→</span>
              <div className="h-5 w-5 rounded border border-outline-variant/30" style={{ backgroundColor: match.closest_brand_color }} />
              <span className={match.within_tolerance ? "text-emerald-400" : "text-error"}>
                ΔE {match.distance}
              </span>
              {match.within_tolerance ? (
                <svg className="h-3.5 w-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              ) : (
                <svg className="h-3.5 w-3.5 text-error" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              )}
            </div>
          ))}
        </div>
      )}

      {hasForbiddenColors && (
        <div className="rounded-lg bg-error/10 p-3 text-xs text-error flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
          Cores proibidas detectadas na imagem
        </div>
      )}

      {issues.length > 0 && (
        <div className="space-y-1">
          {issues.map((issue, i) => (
            <p key={i} className="text-xs text-on-surface-variant">{issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}
