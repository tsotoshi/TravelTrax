"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Icon } from "./Icon";

type Theme = "system" | "light" | "dark";

function applyTheme(t: Theme) {
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      setTheme((localStorage.getItem("theme") as Theme) || "system");
    } catch {}
  }, []);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);
  const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  return (
    <button
      className="btn btn-ghost size-9 px-0"
      title={`Theme: ${theme} (switch to ${next})`}
      aria-label={`Theme: ${theme}`}
      onClick={() => {
        setTheme(next);
        try {
          localStorage.setItem("theme", next);
        } catch {}
      }}
    >
      <Icon name={theme === "system" ? "monitor" : theme === "light" ? "sun" : "moon"} />
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mode, authReady, userEmail, signOut, error } = useStore();
  const isLogin = pathname === "/login";

  if (isLogin) return <>{children}</>;
  if (mode === "supabase" && (!authReady || !userEmail)) return <div className="min-h-dvh" />;

  const nav = [
    { href: "/", label: "Dashboard", icon: "map" },
    { href: "/import", label: "Import", icon: "upload" },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-edge bg-canvas/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-13 max-w-6xl items-center gap-1 px-4 sm:px-6">
          <Link href="/" className="mr-3 flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label="TravelTrax home">
            <span className="relative inline-flex size-7 items-center justify-center rounded-[7px] bg-accent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">
              <Icon name="plane" className="size-[15px]" />
            </span>
            <span className="hidden text-[15px] font-semibold tracking-[-0.02em] sm:inline">TravelTrax</span>
          </Link>
          <nav className="flex gap-0.5">
            {nav.map((n) => {
              const on = n.href === "/" ? pathname === "/" || pathname.startsWith("/trips") : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={`btn h-8 gap-2 px-2.5 text-[13px] sm:h-8 ${on ? "bg-subtle text-fg" : "btn-ghost"}`}
                >
                  <Icon name={n.icon} className={`size-4 ${on ? "text-accent-ink" : ""}`} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-0.5">
            <ThemeToggle />
            {mode === "supabase" && (
              <button className="btn btn-ghost size-9 px-0" onClick={signOut} title={`Sign out ${userEmail ?? ""}`} aria-label="Sign out">
                <Icon name="logout" />
              </button>
            )}
          </div>
        </div>
      </header>
      {mode === "demo" && (
        <div className="border-b border-amber-500/15 bg-amber-500/[0.06] px-4 py-1.5 text-center text-xs text-amber-800 dark:text-amber-200/80">
          Demo mode — data is saved only in this browser. Add your Supabase keys to sign in and sync across devices.
        </div>
      )}
      {error && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-700 dark:text-red-300">
            <Icon name="alert" className="size-4 shrink-0" /> {error}
          </div>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">{children}</main>
    </div>
  );
}
