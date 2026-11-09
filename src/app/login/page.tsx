"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { supabase } from "@/lib/backend";

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white dark:text-zinc-950">
            <Icon name="plane" className="size-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">TravelTrax</h1>
          <p className="text-sm text-zinc-500">Travel spending and points, in one place.</p>
        </div>

        {!supabase ? (
          <div className="card p-5 text-sm">
            <p>Supabase isn&apos;t configured, so the app is running in demo mode.</p>
            <Link href="/" className="btn btn-primary mt-4 w-full">
              Open demo
            </Link>
          </div>
        ) : (
          <form
            className="card space-y-4 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMsg(null);
              const { data, error } =
                mode === "signin"
                  ? await supabase!.auth.signInWithPassword({ email, password })
                  : await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
              setBusy(false);
              if (error) return setMsg({ ok: false, text: error.message });
              if (mode === "signup" && !data.session)
                setMsg({ ok: true, text: "Check your email to confirm your account, then sign in." });
            }}
          >
            <div className="grid grid-cols-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setMsg(null);
                  }}
                  className={`rounded-lg py-1.5 text-sm font-medium transition ${mode === m ? "bg-white shadow-sm dark:bg-zinc-950" : "text-zinc-500"}`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="input" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
