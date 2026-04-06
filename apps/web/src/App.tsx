import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";
import { useGenerationStore } from "@/stores/generation-store";
import { useThemeStore } from "@/stores/theme-store";
import { UploadZone } from "@/components/UploadZone";
import { UploadProgress } from "@/components/UploadProgress";
import { FileInfo } from "@/components/FileInfo";
import { TypeConfirmation } from "@/components/TypeConfirmation";
import { ProcessingSpinner } from "@/components/ProcessingSpinner";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ContextPreview } from "@/components/ContextPreview";
import { DownloadSection } from "@/components/DownloadSection";
import { HistoryPage } from "@/components/history/HistoryPage";
import { CostEstimationPanel } from "@/components/CostEstimationPanel";
// Feature 2: Brand
import { BrandProfileManager } from "@/components/brand/BrandProfileManager";
import { BrandSelector } from "@/components/brand/BrandSelector";
// Feature 3: Audit — removed from nav
// Feature 4: Quality Gate — removed from nav
// import { useGateStore } from "@/stores/gate-store";
// Feature 6: Image Generation
import { GeneratePanel } from "@/components/GeneratePanel";
import { ProcessWizard } from "@/components/process/ProcessWizard";
import { CropPage } from "@/components/crop/CropPage";
import { GenerateAccordion } from "@/components/generate/GenerateAccordion";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AvatarDropdown } from "@/components/header/AvatarDropdown";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { useSession } from "@/lib/auth-client";

type AppMode = "single" | "brands" | "generate" | "history" | "crop";
type HeaderPage = "dashboard" | "settings";

const NAV_ITEMS: { id: AppMode; label: string; icon: React.ReactNode; dividerBefore?: boolean }[] = [
  {
    id: "single",
    label: "Processar Imagem",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
    ),
  },
  {
    id: "generate",
    label: "Gerar Imagem",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    id: "crop",
    label: "Recortar Imagem",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "Histórico",
    dividerBefore: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  // "Marcas" hidden — feature not ready for demo but code preserved
  // {
  //   id: "brands",
  //   label: "Marcas",
  //   icon: (
  //     <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
  //       <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
  //     </svg>
  //   ),
  // },
];

function App() {
  const { step } = useAppStore();
  const { theme, toggleTheme } = useThemeStore();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const [activeNav, setActiveNav] = useState<AppMode>("single");
  const [activePage, setActivePage] = useState<HeaderPage>("dashboard");
  // const gateSelectedConfigId = useGateStore((s) => s.selectedConfigId);
  const { data: session, isPending: authPending } = useSession();

  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  if (authPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-container-low text-on-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-container-low text-on-surface px-4">
        <AuthGuard><div /></AuthGuard>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen text-on-surface">
      {/* ── Sidebar ──────────────────────────── */}
      <aside
        className={`fixed left-0 inset-y-0 z-40 flex flex-col overflow-hidden border-r border-outline-variant/10 bg-surface-container-low backdrop-blur-xl transition-[width,transform] duration-300 ease-out w-64 ${sidebarOpen ? "translate-x-0 lg:w-64" : "-translate-x-full lg:w-16"} lg:translate-x-0`}
      >
        {/* Sidebar Logo */}
        <div className="flex h-16 items-center justify-between border-b border-outline-variant/10 px-4">
          <button
            onClick={() => {
              setActiveNav("single");
              setActivePage("dashboard");
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className="flex items-center gap-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-dim shadow-[0_0_12px_rgba(133,173,255,0.3)]">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
            <div className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ${sidebarOpen ? "max-w-40 opacity-100 delay-100" : "max-w-0 opacity-0"}`}>
              <span className="text-lg font-bold tracking-tight text-on-surface font-headline">
                Woli <span className="text-primary">Pixel</span>
              </span>
              <div className="text-xs text-outline font-headline">Curadoria Digital</div>
            </div>
          </button>
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
            className={`overflow-hidden transition-[max-width,opacity] duration-300 ${sidebarOpen ? "max-w-10 opacity-100 delay-100" : "max-w-0 opacity-0 p-0"} rounded-lg p-1.5 text-outline hover:bg-surface-container-high hover:text-on-surface-variant`}
          >
            {theme === "dark" ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {NAV_ITEMS.map((item) => (
            <div key={item.id}>
            {item.dividerBefore && (
              <div className="my-2 mx-3 border-t border-outline-variant/50" />
            )}
            <button
              onClick={() => {
                setActiveNav(item.id);
                setActivePage("dashboard");
                if (window.innerWidth < 1024) setSidebarOpen(false);
                window.scrollTo({ top: 0 });
                if (item.id === "history") {
                  queryClient.invalidateQueries({ queryKey: ["history"] });
                }
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                activeNav === item.id
                  ? "text-primary border-r-4 border-primary bg-primary/10"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ${sidebarOpen ? "max-w-40 opacity-100 delay-100" : "max-w-0 opacity-0"}`}>
                {item.label}
              </span>
            </button>
            </div>
          ))}
        </nav>

        {/* Brand Selector */}
        <BrandSelector />

        {/* Collapse Toggle */}
        <div className="border-t border-outline-variant/10 p-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-outline hover:bg-surface-container-high hover:text-on-surface-variant"
          >
            <svg className={`h-4 w-4 transition-transform duration-300 ease-out ${sidebarOpen ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Backdrop overlay (mobile) */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-300 ease-out lg:hidden ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Main Area ────────────────────────── */}
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-out ml-0 ${sidebarOpen ? "lg:ml-64" : "lg:ml-16"}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant/10 bg-surface/60 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-6">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface lg:hidden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Notification bell */}
            <button className="relative rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>

            {/* User avatar dropdown */}
            <AvatarDropdown session={session} onNavigateSettings={() => setActivePage("settings")} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-8">
          {activePage === "settings" && (
            <AuthGuard>
              <SettingsPage session={session} />
            </AuthGuard>
          )}

          {activePage === "dashboard" && (
          <div className="mx-auto max-w-6xl space-y-6">
            <ErrorBanner />
            <AuthGuard>

            {/* ── Single Image Mode ── */}
            {activeNav === "single" && <ProcessWizard />}

            {/* ── Brand Management (hidden) ── */}
            {activeNav === "brands" && <BrandProfileManager />}

            {/* ── Image Generation ── */}
            {activeNav === "generate" && <GenerateAccordion />}

            {/* ── Crop Tool ── */}
            {activeNav === "crop" && <CropPage />}

            {/* ── History ── */}
            {activeNav === "history" && (
              <div className="max-w-7xl">
                <HistoryPage onNavigateToGenerate={(prompt) => {
                  useGenerationStore.getState().reset();
                  useGenerationStore.getState().setPrompt(prompt);
                  setActiveNav("generate");
                  window.scrollTo({ top: 0 });
                }} />
              </div>
            )}
            </AuthGuard>
          </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
