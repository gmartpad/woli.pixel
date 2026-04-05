import { useAppStore } from "@/stores/app-store";
import { useQuery } from "@tanstack/react-query";
import { fetchImageTypes } from "@/lib/api";

type MockupType = "desktop" | "mobile" | "email" | "browser" | "workspace_card" | "workspace_details" | "gamification_badge" | "gamification_ranking" | "gamification_store" | "gamification_campaign" | "gamification_avatar";

const MOCKUP_OPTIONS: { value: MockupType; label: string }[] = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "email", label: "Email" },
  { value: "browser", label: "Aba do Navegador" },
  { value: "workspace_card", label: "Card do Workspace" },
  { value: "workspace_details", label: "Detalhes do Workspace" },
  { value: "gamification_badge", label: "Badge de Conquista" },
  { value: "gamification_ranking", label: "Ranking" },
  { value: "gamification_store", label: "Loja Virtual" },
  { value: "gamification_campaign", label: "Campanha" },
  { value: "gamification_avatar", label: "Avatar" },
];

const CONTEXT_TO_MOCKUP: Record<string, MockupType> = {
  desktop_login: "desktop",
  desktop_header: "desktop",
  phone_login: "mobile",
  phone_header: "mobile",
  email_header: "email",
  browser_tab: "browser",
  content_viewer: "desktop",
  course_card: "desktop",
  profile_avatar: "mobile",
  map_marker: "desktop",
  workspace_card: "workspace_card",
  workspace_details: "workspace_details",
  gamification_badge: "gamification_badge",
  gamification_ranking: "gamification_ranking",
  gamification_store: "gamification_store",
  gamification_campaign: "gamification_campaign",
  gamification_avatar: "gamification_avatar",
};

function DesktopMockup({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      {/* Monitor bezel */}
      <div className="rounded-t-xl border border-outline-variant/30 bg-surface-container-high/80 p-1">
        {/* Screen */}
        <div className="relative overflow-hidden rounded-t-lg bg-surface-container">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-outline-variant/30 bg-surface-container-high/80 px-3 py-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
            </div>
            <div className="flex-1 rounded bg-surface-bright/60 px-3 py-1 text-center text-[10px] text-on-surface-variant">
              app.woli.com.br
            </div>
          </div>
          {/* Login screen with background image */}
          <div className="relative h-64">
            <img src={imageUrl} alt="Imagem processada no contexto de uso" className="absolute inset-0 h-full w-full object-cover" />
            {/* Login card overlay — keep white for realism */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-64 rounded-lg bg-white/95 p-5 shadow-xl backdrop-blur">
                <div className="mb-3 flex justify-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">W</div>
                </div>
                <p className="mb-3 text-center text-xs text-zinc-600">Acesse sua conta para continuar</p>
                <div className="mb-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] text-zinc-400">E-mail</div>
                <div className="mb-3 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] text-zinc-400">Senha</div>
                <div className="rounded bg-blue-600 py-1.5 text-center text-[10px] font-medium text-white">Entrar</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Monitor stand */}
      <div className="mx-auto h-4 w-24 rounded-b-lg bg-surface-bright/80" />
      <div className="mx-auto h-1 w-32 rounded-b bg-outline-variant/60" />
    </div>
  );
}

function MobileMockup({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mx-auto w-48">
      {/* Phone frame */}
      <div className="rounded-[2rem] border-4 border-outline-variant/50 bg-surface-container-high/80 p-1">
        {/* Notch */}
        <div className="mx-auto mb-1 h-4 w-20 rounded-b-xl bg-surface-container" />
        {/* Screen */}
        <div className="relative overflow-hidden rounded-2xl bg-surface-container">
          <div className="relative h-80">
            <img src={imageUrl} alt="Imagem processada no contexto de uso" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-44 rounded-lg bg-white/95 p-4 shadow-xl backdrop-blur">
                <div className="mb-2 flex justify-center">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-[10px] font-bold text-white">W</div>
                </div>
                <p className="mb-2 text-center text-[9px] text-zinc-600">Bem-vindo</p>
                <div className="mb-1.5 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[8px] text-zinc-400">E-mail</div>
                <div className="mb-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[8px] text-zinc-400">Senha</div>
                <div className="rounded bg-blue-600 py-1 text-center text-[8px] font-medium text-white">Entrar</div>
              </div>
            </div>
          </div>
        </div>
        {/* Home indicator */}
        <div className="mx-auto mt-2 mb-1 h-1 w-16 rounded-full bg-outline-variant/60" />
      </div>
    </div>
  );
}

function EmailMockup({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mx-auto max-w-lg">
      {/* Email client — keep white interior for realism */}
      <div className="rounded-lg border border-outline-variant/30 bg-white">
        {/* Email header bar */}
        <div className="border-b border-zinc-200 bg-zinc-100 px-4 py-2">
          <div className="text-[10px] text-zinc-400">De: noreply@woli.com.br</div>
          <div className="text-xs font-medium text-zinc-700">Woli — Plataforma de Educacao Corporativa</div>
        </div>
        {/* Testeira image */}
        <div className="border-b border-zinc-200">
          <img src={imageUrl} alt="Imagem processada no contexto de uso" className="h-16 w-full object-cover" />
        </div>
        {/* Email body placeholder */}
        <div className="space-y-2 p-4">
          <div className="h-3 w-3/4 rounded bg-zinc-200" />
          <div className="h-3 w-full rounded bg-zinc-200" />
          <div className="h-3 w-5/6 rounded bg-zinc-200" />
          <div className="h-3 w-2/3 rounded bg-zinc-200" />
        </div>
      </div>
    </div>
  );
}

function BrowserTabMockup({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-t-lg border border-outline-variant/30 bg-surface-container-high/80">
        {/* Tab bar */}
        <div className="flex items-end gap-0.5 px-2 pt-2">
          <div className="flex items-center gap-2 rounded-t-lg bg-surface-bright/60 px-3 py-1.5">
            <img src={imageUrl} alt="Icone no contexto de aba do navegador" className="h-4 w-4 rounded-sm object-contain" />
            <span className="text-[10px] text-on-surface-variant">Woli — Plataforma</span>
            <span className="text-[10px] text-outline">&times;</span>
          </div>
          <div className="rounded-t-lg bg-surface-container-high/60 px-3 py-1.5 text-[10px] text-outline">+</div>
        </div>
        {/* URL bar */}
        <div className="flex items-center gap-2 border-t border-outline-variant/30 px-3 py-1.5">
          <div className="flex gap-1">
            <span className="text-outline text-[10px]">&larr;</span>
            <span className="text-outline text-[10px]">&rarr;</span>
          </div>
          <div className="flex-1 rounded bg-surface-bright/60 px-2 py-1 text-[10px] text-on-surface-variant">
            app.woli.com.br
          </div>
        </div>
      </div>
      {/* Page content */}
      <div className="border-x border-b border-outline-variant/30 bg-surface-container/80 p-6">
        <div className="flex items-center gap-3 mb-4">
          <img src={imageUrl} alt="Icone em tamanho ampliado" className="h-8 w-8 rounded object-contain" />
          <span className="text-sm font-medium text-on-surface-variant">Woli — Plataforma de Educacao</span>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-surface-container-high/80" />
          <div className="h-3 w-4/5 rounded bg-surface-container-high/80" />
          <div className="h-3 w-3/4 rounded bg-surface-container-high/80" />
        </div>
      </div>
    </div>
  );
}

const CARD_STYLES = {
  desktop: {
    menuTransform: "scale(0.775)",
    titleFontSize: "0.875rem",
    titleLineHeight: "1.188rem",
    subtitleFontSize: "0.5rem",
    progressHeight: "8px",
    percentFontSize: "0.75rem",
  },
  mobile: {
    menuTransform: "scale(0.65)",
    titleFontSize: "0.75rem",
    titleLineHeight: "1rem",
    subtitleFontSize: "0.4375rem",
    progressHeight: "6px",
    percentFontSize: "0.625rem",
  },
} as const;

function WorkspaceCardContent({ imageUrl, variant }: { imageUrl: string; variant: "desktop" | "mobile" }) {
  const s = CARD_STYLES[variant];
  return (
    <>
      <img
        src={imageUrl}
        alt="Card do workspace com imagem processada"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Menu button — glass pill, top-right (LXP .menu-button) */}
      <div
        className="absolute z-10 flex items-center justify-center text-white/90"
        style={{
          top: "0.25rem",
          right: "0.25rem",
          backdropFilter: "blur(0.5rem) saturate(2)",
          WebkitBackdropFilter: "blur(0.5rem) saturate(2)",
          background: "rgba(30,30,30,0.55)",
          border: "1px solid rgba(220,220,220,0.25)",
          borderRadius: "2rem",
          padding: "0.25rem",
          fontSize: "1.5rem",
          lineHeight: 1,
          transform: s.menuTransform,
        }}
      >
        ⋯
      </div>
      {/* Overlay bar — bottom-anchored (LXP .overlay) */}
      <div
        className="absolute overflow-hidden"
        style={{
          bottom: "-1px",
          left: "-1px",
          right: "-1px",
          borderBottomLeftRadius: "inherit",
          borderBottomRightRadius: "inherit",
        }}
      >
        {/* Blurred image substrate (LXP .overlay::before) */}
        <div
          className="absolute"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "bottom",
            backgroundRepeat: "no-repeat",
            filter: "blur(7px)",
            bottom: "-10px",
            left: "-10px",
            right: "-10px",
            height: "200%",
            zIndex: 0,
          }}
        />
        {/* Gradient + blur + highlight (LXP .overlay::after) */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(rgba(0,0,0,0.4), rgba(45,45,45,0.8))",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow:
              "inset 0 1px 0px 0px rgba(80,80,80,1), inset 0 2px 0px 0px rgba(255,255,255,0.3)",
            borderBottomLeftRadius: "inherit",
            borderBottomRightRadius: "inherit",
            zIndex: 1,
          }}
        />
        {/* Content on top of overlay layers */}
        <div className="relative flex flex-col" style={{ zIndex: 2, padding: "0.5rem" }}>
          <div
            className="text-white font-bold"
            style={{
              fontSize: s.titleFontSize,
              lineHeight: s.titleLineHeight,
              letterSpacing: "0.64px",
            }}
          >
            Nome do Workspace
          </div>
          <div
            className="text-white mt-0.5 line-clamp-2"
            style={{
              fontSize: s.subtitleFontSize,
              fontWeight: 300,
              lineHeight: "0.688rem",
              letterSpacing: "0.36px",
            }}
          >
            Autor do canal
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <div
              className="flex-1 overflow-hidden"
              style={{
                height: s.progressHeight,
                background: "rgba(200,200,200,0.65)",
                borderRadius: "4px",
                boxShadow: "0 0 4px rgba(0,0,0,0.1)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: "0%",
                  background: "#ef4444",
                  borderRadius: "4px",
                }}
              />
            </div>
            <div
              style={{
                padding: "2px 4px",
                fontSize: s.percentFontSize,
                fontWeight: 600,
                backgroundColor: "#ffffff",
                color: "#333333",
                borderRadius: "4px",
                lineHeight: 1,
              }}
            >
              0%
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function WorkspaceCardPhoneFrame({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="w-[220px]">
      {/* Phone bezel */}
      <div className="rounded-[2rem] border-4 border-outline-variant/50 bg-surface-container-high/80 p-1">
        {/* Notch */}
        <div className="mx-auto mb-1 h-4 w-20 rounded-b-xl bg-surface-container" />
        {/* Screen */}
        <div className="overflow-hidden rounded-2xl bg-surface-container">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1">
            <span className="text-[8px] font-medium text-on-surface-variant">9:41</span>
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-2.5 rounded-sm bg-on-surface-variant/60" />
              <div className="h-1.5 w-1.5 rounded-full bg-on-surface-variant/60" />
              <div className="h-1.5 w-3 rounded-sm border border-on-surface-variant/60">
                <div className="h-full w-2/3 rounded-sm bg-on-surface-variant/60" />
              </div>
            </div>
          </div>
          {/* Card area */}
          <div className="px-2 pb-3">
            <div
              className="aspect-square overflow-hidden rounded-xl relative"
              style={{
                boxShadow:
                  "rgba(0,0,0,0.2) 0px 2px 1px -1px, rgba(0,0,0,0.14) 0px 1px 1px 0px, rgba(0,0,0,0.12) 0px 1px 3px 0px",
              }}
            >
              <WorkspaceCardContent imageUrl={imageUrl} variant="mobile" />
            </div>
          </div>
          {/* Skeleton lines below card (context) */}
          <div className="space-y-1.5 px-2 pb-3">
            <div className="h-2 w-3/4 rounded bg-outline-variant/20" />
            <div className="h-2 w-1/2 rounded bg-outline-variant/20" />
          </div>
        </div>
        {/* Home indicator */}
        <div className="mx-auto mt-2 mb-1 h-1 w-16 rounded-full bg-outline-variant/60" />
      </div>
    </div>
  );
}

function WorkspaceCardMockup({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-8">
      {/* Desktop */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-[298px] max-w-full aspect-square overflow-hidden rounded-xl relative"
          style={{
            boxShadow:
              "rgba(0,0,0,0.2) 0px 2px 1px -1px, rgba(0,0,0,0.14) 0px 1px 1px 0px, rgba(0,0,0,0.12) 0px 1px 3px 0px",
          }}
        >
          <WorkspaceCardContent imageUrl={imageUrl} variant="desktop" />
        </div>
        <span className="text-xs font-medium text-on-surface-variant font-label tracking-wide uppercase">Desktop</span>
      </div>

      {/* Mobile */}
      <div className="flex flex-col items-center gap-3">
        <WorkspaceCardPhoneFrame imageUrl={imageUrl} />
        <span className="text-xs font-medium text-on-surface-variant font-label tracking-wide uppercase">Mobile</span>
      </div>
    </div>
  );
}

function WorkspaceDetailsMockup({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      {/* Browser chrome */}
      <div className="rounded-t-lg border border-zinc-600/40 bg-zinc-800">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
          </div>
          <div className="flex-1 rounded bg-zinc-700 px-3 py-1 text-center text-[10px] text-zinc-400">
            app.woli.com.br/workspace/nome-do-workspace
          </div>
        </div>
      </div>

      {/* App content area */}
      <div className="overflow-hidden border-x border-zinc-600/40 bg-zinc-900">
        {/* Header banner — 125px (LXP --header-height at ≥600px) */}
        <div className="relative overflow-hidden" style={{ height: "125px" }}>
          <img
            src={imageUrl}
            alt="Imagem de fundo do workspace"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Dark overlay — gray not black (RoomDetails: rgba(55,55,55,0.85)) */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(55,55,55,0.85)" }}
          />
          {/* Gradient (RoomDetails: rgba(0,0,0,0.825) → transparent) */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0.825), transparent)",
            }}
          />
          {/* Header content — flex row layout (LXP .container: flex row nowrap) */}
          <div
            className="relative flex h-full items-center px-4"
            style={{ flexFlow: "row nowrap" }}
          >
            {/* Back button */}
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </div>
            {/* Title container (LXP .title-container: padding-left 1rem at ≥905px) */}
            <div className="flex-1 min-w-0" style={{ paddingLeft: "1rem", paddingRight: "0.25rem" }}>
              {/* Title (LXP .title at ≥600px: 1.75rem bold) */}
              <div
                className="text-white font-bold truncate"
                style={{ fontSize: "1.75rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                Nome do Workspace
              </div>
              {/* Author (LXP .autor at ≥600px: 0.75rem) */}
              <div
                className="text-white block w-full"
                style={{ fontSize: "0.75rem" }}
              >
                Autor do canal &middot; 01/04/2026
              </div>
            </div>
            {/* Menu button — glass pill (LXP .moreOptions > .menu-button) */}
            <div
              className="flex-shrink-0 flex items-center justify-center text-white/90"
              style={{
                backdropFilter: "blur(0.5rem) saturate(2)",
                WebkitBackdropFilter: "blur(0.5rem) saturate(2)",
                background: "rgba(30,30,30,0.55)",
                border: "1px solid rgba(220,220,220,0.25)",
                borderRadius: "2rem",
                padding: "0.5rem",
                fontSize: "1.5rem",
                lineHeight: 1,
              }}
            >
              ⋯
            </div>
          </div>
        </div>

        {/* White content area below header */}
        <div className="bg-white p-5 space-y-3">
          <div className="h-3 w-1/3 rounded bg-zinc-200" />
          <div className="h-2.5 w-full rounded bg-zinc-100" />
          <div className="h-2.5 w-5/6 rounded bg-zinc-100" />
          <div className="h-2.5 w-4/6 rounded bg-zinc-100" />
          <div className="mt-4 h-3 w-1/4 rounded bg-zinc-200" />
          <div className="h-2.5 w-full rounded bg-zinc-100" />
          <div className="h-2.5 w-3/4 rounded bg-zinc-100" />
        </div>
      </div>

      {/* Bottom border */}
      <div className="h-1 rounded-b-lg border-x border-b border-zinc-600/40 bg-zinc-800" />
    </div>
  );
}

function GamificationBadgeMockup({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-xl bg-surface-container-low/80 p-4 space-y-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-full bg-surface-container-high" />
          <div>
            <div className="h-3 w-24 rounded bg-surface-container-high" />
            <div className="h-2 w-16 rounded bg-surface-container-high/60 mt-1" />
          </div>
        </div>
        <div className="text-xs text-on-surface-variant mb-1">Conquistas</div>
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-primary/30 shadow-[0_0_12px_rgba(133,173,255,0.2)] bg-surface-container">
            <img src={imageUrl} alt="Badge" className="h-full w-full object-contain" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-16 rounded-full bg-surface-container-high/50 border border-outline-variant/20" />
          ))}
        </div>
      </div>
    </div>
  );
}

function GamificationRankingMockup({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mx-auto max-w-xs">
      <div className="rounded-xl bg-surface-container-low/80 p-4 space-y-2">
        <div className="text-xs text-on-surface-variant mb-2">Ranking</div>
        {[1, 2, 3].map((pos) => (
          <div key={pos} className={`flex items-center gap-3 rounded-lg p-2 ${pos === 1 ? "bg-primary/10" : "bg-surface-container-high/50"}`}>
            <span className="text-sm font-bold text-on-surface-variant w-4">{pos}</span>
            <div className="h-12 w-12 rounded-full overflow-hidden bg-surface-container flex-shrink-0">
              {pos === 1 ? (
                <img src={imageUrl} alt="Medal" className="h-full w-full object-contain" />
              ) : (
                <div className="h-full w-full bg-surface-container-high/60" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="h-2.5 w-20 rounded bg-surface-container-high" />
              <div className="h-2 w-12 rounded bg-surface-container-high/60 mt-1" />
            </div>
            <span className="text-xs font-medium text-on-surface-variant">{pos === 1 ? "1.250" : pos === 2 ? "980" : "845"} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GamificationStoreMockup({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl bg-surface-container-low/80 p-4">
        <div className="text-xs text-on-surface-variant mb-3">Loja Virtual</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-container-high/60 p-3 text-center border border-primary/20">
            <div className="mx-auto h-[120px] w-[120px] rounded-lg bg-surface-container overflow-hidden mb-2">
              <img src={imageUrl} alt="Reward" className="h-full w-full object-contain" />
            </div>
            <div className="text-xs font-medium text-on-surface">Recompensa</div>
            <div className="text-[10px] text-primary font-bold mt-1">500 pts</div>
            <button className="mt-2 w-full rounded-lg bg-primary/20 py-1 text-[10px] font-medium text-primary">Resgatar</button>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-container-high/30 p-3 text-center">
              <div className="mx-auto h-[120px] w-[120px] rounded-lg bg-surface-container-high/50 mb-2" />
              <div className="h-2.5 w-16 mx-auto rounded bg-surface-container-high" />
              <div className="h-2 w-10 mx-auto rounded bg-surface-container-high/60 mt-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GamificationCampaignMockup({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl bg-surface-container-low/80 overflow-hidden">
        <img src={imageUrl} alt="Campaign banner" className="w-full h-20 object-cover" />
        <div className="p-4 space-y-3">
          <div className="text-xs text-on-surface-variant">Desafios da Campanha</div>
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-container-high/40 p-3">
              <div className="h-8 w-8 rounded bg-surface-container-high" />
              <div className="flex-1">
                <div className="h-2.5 w-32 rounded bg-surface-container-high" />
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${i * 35}%` }} />
                </div>
              </div>
              <span className="text-[10px] text-outline">{i * 35}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GamificationAvatarMockup({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mx-auto max-w-xs">
      <div className="rounded-xl bg-surface-container-low/80 p-4">
        <div className="flex items-start gap-3">
          <div className="h-20 w-20 rounded-full overflow-hidden bg-surface-container border-2 border-primary/20 flex-shrink-0">
            <img src={imageUrl} alt="Avatar" className="h-full w-full object-contain" />
          </div>
          <div className="flex-1 rounded-xl bg-surface-container-high/50 p-3 relative">
            <div className="absolute left-[-6px] top-4 h-3 w-3 rotate-45 bg-surface-container-high/50" />
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Parabéns! Você completou o módulo de Onboarding. Continue assim!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContextPreview() {
  const { step, processedResult, uploadId, selectedTypeId } = useAppStore();
  const { data: typesData } = useQuery<{ types: any[] }>({
    queryKey: ["image-types"],
    queryFn: fetchImageTypes,
  });

  if (step !== "processed" || !processedResult || !uploadId) return null;

  const downloadUrl = `/api/v1/images/${uploadId}/download`;

  // Determine default mockup from the selected type's preview_context
  const selectedType = typesData?.types?.find((t: any) => t.id === selectedTypeId);
  const defaultMockup = selectedType?.previewContext
    ? CONTEXT_TO_MOCKUP[selectedType.previewContext] || "desktop"
    : "desktop";

  return (
    <div className="glass-card space-y-4 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-on-surface font-headline">Pre-visualizacao em Contexto</h3>

      {/* Context label */}
      <p className="text-sm text-on-surface-variant">
        {MOCKUP_OPTIONS.find(o => o.value === defaultMockup)?.label}
      </p>

      {/* Mockup Frame */}
      <div className="rounded-xl bg-surface-container/40 p-8 transition-all duration-300 border border-outline-variant/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        {defaultMockup === "desktop" && <DesktopMockup imageUrl={downloadUrl} />}
        {defaultMockup === "mobile" && <MobileMockup imageUrl={downloadUrl} />}
        {defaultMockup === "email" && <EmailMockup imageUrl={downloadUrl} />}
        {defaultMockup === "browser" && <BrowserTabMockup imageUrl={downloadUrl} />}
        {defaultMockup === "workspace_card" && <WorkspaceCardMockup imageUrl={downloadUrl} />}
        {defaultMockup === "workspace_details" && <WorkspaceDetailsMockup imageUrl={downloadUrl} />}
        {defaultMockup === "gamification_badge" && <GamificationBadgeMockup imageUrl={downloadUrl} />}
        {defaultMockup === "gamification_ranking" && <GamificationRankingMockup imageUrl={downloadUrl} />}
        {defaultMockup === "gamification_store" && <GamificationStoreMockup imageUrl={downloadUrl} />}
        {defaultMockup === "gamification_campaign" && <GamificationCampaignMockup imageUrl={downloadUrl} />}
        {defaultMockup === "gamification_avatar" && <GamificationAvatarMockup imageUrl={downloadUrl} />}
      </div>
    </div>
  );
}
