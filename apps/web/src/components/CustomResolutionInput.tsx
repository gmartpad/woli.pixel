import { useState, useEffect } from "react";

type Props = {
  width: number | null;
  height: number | null;
  onChange: (w: number, h: number) => void;
};

const MIN_DIM = 16;
const MAX_DIM = 4096;
const MAX_MP = 4.2;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function getAspectRatio(w: number, h: number): string {
  const d = gcd(w, h);
  const rw = w / d;
  const rh = h / d;
  // Cap simplification for large ratios
  if (rw > 50 || rh > 50) return `${w}:${h}`;
  return `${rw}:${rh}`;
}

export function CustomResolutionInput({ width, height, onChange }: Props) {
  const [wInput, setWInput] = useState(width?.toString() ?? "");
  const [hInput, setHInput] = useState(height?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);

  // Sync controlled props → internal state
  useEffect(() => {
    setWInput(width?.toString() ?? "");
  }, [width]);
  useEffect(() => {
    setHInput(height?.toString() ?? "");
  }, [height]);

  const validate = (w: number, h: number): string | null => {
    if (w < MIN_DIM || h < MIN_DIM) return `Dimensão mínima: ${MIN_DIM}px`;
    if (w > MAX_DIM || h > MAX_DIM) return `Dimensão máxima: ${MAX_DIM}px`;
    const mp = (w * h) / 1_000_000;
    if (mp > MAX_MP) return `Máximo ${MAX_MP}MP (atual: ${mp.toFixed(1)}MP)`;
    return null;
  };

  const tryEmit = (wStr: string, hStr: string) => {
    const w = parseInt(wStr);
    const h = parseInt(hStr);
    if (isNaN(w) || isNaN(h)) {
      setError(null);
      return;
    }
    const err = validate(w, h);
    setError(err);
    if (!err) onChange(w, h);
  };

  const mp = width && height ? ((width * height) / 1_000_000).toFixed(1) : null;
  const ratio = width && height ? getAspectRatio(width, height) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="custom-w" className="block text-xs text-on-surface-variant mb-1">
            Largura (px)
          </label>
          <input
            id="custom-w"
            type="number"
            min={MIN_DIM}
            max={MAX_DIM}
            value={wInput}
            onChange={(e) => {
              setWInput(e.target.value);
              tryEmit(e.target.value, hInput);
            }}
            onBlur={() => tryEmit(wInput, hInput)}
            placeholder="1920"
            className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-3 py-2 text-on-surface font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            const newW = hInput;
            const newH = wInput;
            setWInput(newW);
            setHInput(newH);
            tryEmit(newW, newH);
          }}
          aria-label="Trocar dimensões"
          className="mb-0.5 rounded-lg p-2 text-outline hover:bg-surface-container-high hover:text-on-surface-variant"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </button>

        <div className="flex-1">
          <label htmlFor="custom-h" className="block text-xs text-on-surface-variant mb-1">
            Altura (px)
          </label>
          <input
            id="custom-h"
            type="number"
            min={MIN_DIM}
            max={MAX_DIM}
            value={hInput}
            onChange={(e) => {
              setHInput(e.target.value);
              tryEmit(wInput, e.target.value);
            }}
            onBlur={() => tryEmit(wInput, hInput)}
            placeholder="1080"
            className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-3 py-2 text-on-surface font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Meta row */}
      {mp && ratio && (
        <div className="flex gap-2 text-xs">
          <span className="rounded-md bg-surface-container-high px-2 py-1 text-on-surface-variant">
            {ratio}
          </span>
          <span className="rounded-md bg-surface-container-high px-2 py-1 text-on-surface-variant font-mono">
            {mp} MP
          </span>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
