import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme-store";

export function AppearanceCard() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <div className="glass-card rounded-xl p-5">
      <h2 className="text-lg font-bold text-on-surface font-headline mb-4">Aparência</h2>

      <div className="flex gap-4">
        {/* Dark theme option */}
        <button
          aria-label="Escuro"
          onClick={() => { if (theme !== "dark") toggleTheme(); }}
          className={cn(
            "flex-1 rounded-xl border-2 p-1 transition-colors cursor-pointer",
            theme === "dark" ? "border-primary" : "border-outline-variant/30",
          )}
        >
          <div className="rounded-lg bg-[#1a1a2e] p-3 space-y-2">
            <div className="h-2 w-3/4 rounded bg-[#2a2a4a]" />
            <div className="h-2 w-1/2 rounded bg-[#2a2a4a]" />
            <div className="h-2 w-2/3 rounded bg-[#2a2a4a]" />
          </div>
          <div className="flex items-center justify-center gap-1.5 pt-2 pb-1">
            {theme === "dark" && (
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            <span className="text-sm font-medium text-on-surface">Escuro</span>
          </div>
        </button>

        {/* Light theme option */}
        <button
          aria-label="Claro"
          onClick={() => { if (theme !== "light") toggleTheme(); }}
          className={cn(
            "flex-1 rounded-xl border-2 p-1 transition-colors cursor-pointer",
            theme === "light" ? "border-primary" : "border-outline-variant/30",
          )}
        >
          <div className="rounded-lg bg-[#f0f0f5] p-3 space-y-2">
            <div className="h-2 w-3/4 rounded bg-[#d8d8e0]" />
            <div className="h-2 w-1/2 rounded bg-[#d8d8e0]" />
            <div className="h-2 w-2/3 rounded bg-[#d8d8e0]" />
          </div>
          <div className="flex items-center justify-center gap-1.5 pt-2 pb-1">
            {theme === "light" && (
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            <span className="text-sm font-medium text-on-surface">Claro</span>
          </div>
        </button>
      </div>
    </div>
  );
}
