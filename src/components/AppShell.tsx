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
      className="btn btn-ghost size-10 px-0"
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
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link href="/" className="mr-2 flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-[var(--accent)] text-white dark:text-zinc-950">
              <Icon name="plane" className="size-4" />
            </span>
            <span className="hidden sm:inline">TravelTrax</span>
          </Link>
          <nav className="flex gap-1">
            {nav.map((n) => {
              const on = n.href === "/" ? pathname === "/" || pathname.startsWith("/trips") : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`btn h-9 px-3 ${on ? "bg-zinc-100 dark:bg-zinc-800" : "btn-ghost"}`}
                >
                  <Icon name={n.icon} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {mode === "supabase" && (
              <button className="btn btn-ghost size-10 px-0" onClick={signOut} title={`Sign out ${userEmail ?? ""}`} aria-label="Sign out">
                <Icon name="logout" />
              </button>
            )}
          </div>
        </div>
      </header>
      {mode === "demo" && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Demo mode — data is saved only in this browser. Add your Supabase keys to sign in and sync across devices.
        </div>
      )}
      {error && (
        <div className="mx-auto mt-4 max-w-6xl px-4">
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            <Icon name="alert" /> {error}
          </div>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 pt-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:pt-8">{children}</main>
    </div>
  );
}
