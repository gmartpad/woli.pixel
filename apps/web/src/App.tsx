import { useState, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
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
import { ProcessingHistory } from "@/components/ProcessingHistory";
import { CostEstimationPanel } from "@/components/CostEstimationPanel";
// Feature 1: Batch
import { BatchUploadZone } from "@/components/batch/BatchUploadZone";
import { BatchProgressGrid } from "@/components/batch/BatchProgressGrid";
import { BatchSummary } from "@/components/batch/BatchSummary";
import { BatchReviewTable } from "@/components/batch/BatchReviewTable";
// Feature 2: Brand
import { BrandProfileManager } from "@/components/brand/BrandProfileManager";
import { BrandSelector } from "@/components/brand/BrandSelector";
// Feature 3: Audit
import { AuditSetup } from "@/components/audit/AuditSetup";
import { AuditProgress } from "@/components/audit/AuditProgress";
import { AuditReport } from "@/components/audit/AuditReport";
// Feature 4: Quality Gate
import { GateConfigManager } from "@/components/gates/GateConfigManager";
import { GateTestPanel } from "@/components/gates/GateTestPanel";
import { GateResultsDashboard } from "@/components/gates/GateResultsDashboard";
import { useGateStore } from "@/stores/gate-store";

type AppMode = "single" | "batch" | "brands" | "audit" | "gates";

const NAV_ITEMS: { id: AppMode; label: string; icon: React.ReactNode }[] = [
  {
    id: "single",
    label: "Imagem Única",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
    ),
  },
  {
    id: "batch",
    label: "Lote",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
    ),
  },
  {
    id: "audit",
    label: "Auditoria",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    id: "brands",
    label: "Marcas",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
      </svg>
    ),
  },
  {
    id: "gates",
    label: "Quality Gate",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

function App() {
  const { step } = useAppStore();
  const { theme, toggleTheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const [activeNav, setActiveNav] = useState<AppMode>("single");
  const gateSelectedConfigId = useGateStore((s) => s.selectedConfigId);

  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen text-on-surface">
      {/* ── Sidebar ──────────────────────────── */}
      <aside
        className={`fixed left-0 inset-y-0 z-40 flex flex-col overflow-hidden border-r border-outline-variant/10 bg-surface-container-low backdrop-blur-xl transition-[width,transform] duration-300 ease-out w-64 ${sidebarOpen ? "translate-x-0 lg:w-64" : "-translate-x-full lg:w-16"} lg:translate-x-0`}
      >
        {/* Sidebar Logo */}
        <div className="flex h-16 items-center justify-between border-b border-outline-variant/10 px-4">
          <div className="flex items-center gap-3">
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
          </div>
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
            <button
              key={item.id}
              onClick={() => {
                setActiveNav(item.id);
                if (window.innerWidth < 1024) setSidebarOpen(false);
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
            {/* Header Tabs */}
            <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {["Dashboard", "Histórico", "Configurações"].map((tab, i) => (
                <span
                  key={tab}
                  className={`whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-colors font-headline ${
                    i === 0
                      ? "text-primary border-b-2 border-primary"
                      : "text-outline hover:text-on-surface-variant"
                  }`}
                >
                  {tab}
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Notification bell */}
            <button className="relative rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>

            {/* Settings gear */}
            <button className="hidden sm:block rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* User avatar */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white shadow-[0_0_10px_rgba(133,173,255,0.2)]">
              GM
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <ErrorBanner />

            {/* ── Single Image Mode ── */}
            {activeNav === "single" && (
              <>
                {step === "idle" && (
                  <div className="text-center py-2 sm:py-4">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-primary font-headline">
                      Curadoria de Imagens por IA
                    </h1>
                    <p className="mt-3 text-on-surface-variant text-base sm:text-lg max-w-xl mx-auto">
                      Valide, redimensione e otimize seus ativos visuais com precisão cirúrgica.
                    </p>
                  </div>
                )}
                <UploadZone />
                <UploadProgress />
                {step !== "idle" && step !== "uploading" && <FileInfo />}
                <TypeConfirmation />
                <ProcessingSpinner />
                <ResultsPanel />
                <ContextPreview />
                <DownloadSection />
                <ProcessingHistory />
                <CostEstimationPanel />
              </>
            )}

            {/* ── Batch Mode ── */}
            {activeNav === "batch" && (
              <>
                <BatchUploadZone />
                <BatchProgressGrid />
                <BatchSummary />
                <BatchReviewTable />
              </>
            )}

            {/* ── Audit Mode ── */}
            {activeNav === "audit" && (
              <>
                <AuditSetup />
                <AuditProgress />
                <AuditReport />
              </>
            )}

            {/* ── Brand Management ── */}
            {activeNav === "brands" && <BrandProfileManager />}

            {/* ── Quality Gates ── */}
            {activeNav === "gates" && (
              <div className="space-y-6">
                <GateConfigManager />
                {gateSelectedConfigId && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <GateTestPanel />
                    <GateResultsDashboard />
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
