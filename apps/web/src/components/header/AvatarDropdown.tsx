import { useState, useEffect } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useThemeStore } from "@/stores/theme-store";
import { signOut } from "@/lib/auth-client";

interface AvatarDropdownProps {
  session: {
    user: {
      name: string | null;
      email: string;
      image?: string | null;
      [key: string]: unknown;
    };
  };
  onNavigateSettings: () => void;
}

export function AvatarDropdown({ session, onNavigateSettings }: AvatarDropdownProps) {
  const [open, setOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const initials = session.user.name?.slice(0, 2).toUpperCase() || "U";

  useEffect(() => {
    setImageLoaded(false);
  }, [session.user.image]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu do usuário"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white shadow-[0_0_10px_rgba(133,173,255,0.2)] hover:opacity-80 transition-opacity overflow-hidden"
      >
        {session.user.image && (
          <img
            src={session.user.image}
            alt="Avatar"
            className="h-8 w-8 rounded-full object-cover"
            style={{ display: imageLoaded ? "block" : "none" }}
            onLoad={() => setImageLoaded(true)}
          />
        )}
        {(!session.user.image || !imageLoaded) && initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-outline-variant/20 bg-surface-container-low p-1 shadow-lg animate-fade-slide-in">
          {/* User info */}
          <div className="px-3 py-2.5">
            <p className="text-sm font-bold text-on-surface">{session.user.name || "Usuário"}</p>
            <p className="text-xs text-outline">{session.user.email}</p>
          </div>

          <div className="border-t border-outline-variant/20 mx-2" />

          {/* Theme toggle */}
          <button
            onClick={() => toggleTheme()}
            aria-label="Alternar tema"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
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
            <span>Tema</span>
            <span className="ml-auto text-xs text-outline capitalize">{theme === "dark" ? "Escuro" : "Claro"}</span>
          </button>

          {/* Settings link */}
          <button
            onClick={() => {
              onNavigateSettings();
              setOpen(false);
            }}
            aria-label="Configurações"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Configurações</span>
          </button>

          <div className="border-t border-outline-variant/20 mx-2" />

          {/* Sign out */}
          <button
            onClick={() => signOut({ fetchOptions: { onSuccess: () => window.location.reload() } })}
            aria-label="Sair"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span>Sair</span>
          </button>
        </div>
      )}
    </div>
  );
}
