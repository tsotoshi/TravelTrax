"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { demoBackend, supabase, supabaseBackend, type Backend } from "./backend";
import { uuid } from "./format";
import { sampleData } from "./sample";
import type { Expense, ExpenseInput, Trip, TripInput } from "./types";

interface Store {
  mode: "demo" | "supabase";
  authReady: boolean;
  userEmail: string | null;
  ready: boolean;
  error: string | null;
  trips: Trip[];
  expenses: Expense[];
  addTrip(input: TripInput): Promise<Trip>;
  updateTrip(id: string, input: TripInput): Promise<void>;
  deleteTrip(id: string): Promise<void>;
  addExpenses(inputs: ExpenseInput[]): Promise<void>;
  updateExpense(id: string, input: ExpenseInput): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  addBulk(trips: Trip[], expenses: Expense[]): Promise<void>;
  loadSamples(): Promise<void>;
  signOut(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside DataProvider");
  return s;
}

const message = (e: unknown) => (e && typeof e === "object" && "message" in e ? String(e.message) : String(e));

export function DataProvider({ children }: { children: ReactNode }) {
  const mode = supabase ? "supabase" : "demo";
  const router = useRouter();
  const pathname = usePathname();
  const [authReady, setAuthReady] = useState(mode === "demo");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backendRef = useRef<Backend | null>(null);

  const backend = useCallback(() => {
    if (!backendRef.current) backendRef.current = supabase ? supabaseBackend(supabase) : demoBackend();
    return backendRef.current;
  }, []);

  // Auth state
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setUserEmail(data.session?.user.email ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setUserEmail(session?.user.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Route guard
  useEffect(() => {
    if (mode !== "supabase" || !authReady) return;
    if (!userId && pathname !== "/login") router.replace("/login");
    if (userId && pathname === "/login") router.replace("/");
  }, [mode, authReady, userId, pathname, router]);

  const reload = useCallback(async () => {
    try {
      const d = await backend().load();
      setTrips(d.trips);
      setExpenses(d.expenses);
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setReady(true);
    }
  }, [backend]);

  // Load data when signed in (or in demo mode); refresh when the tab regains focus so
  // changes made on another device show up.
  useEffect(() => {
    if (mode === "supabase" && !userId) {
      setTrips([]);
      setExpenses([]);
      setReady(false);
      return;
    }
    reload();
    if (mode !== "supabase") return;
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [mode, userId, reload]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(message(e));
      throw e;
    }
  }, []);

  const store = useMemo<Store>(() => {
    const addBulk = (newTrips: Trip[], newExpenses: Expense[]) =>
      run(async () => {
        await backend().insertTrips(newTrips);
        await backend().insertExpenses(newExpenses);
        setTrips((t) => [...t, ...newTrips]);
        setExpenses((x) => [...x, ...newExpenses]);
      });
    return {
      mode,
      authReady,
      userEmail,
      ready,
      error,
      trips,
      expenses,
      async addTrip(input) {
        const trip: Trip = { ...input, id: uuid(), created_at: new Date().toISOString() };
        await run(async () => {
          await backend().insertTrips([trip]);
          setTrips((t) => [...t, trip]);
        });
        return trip;
      },
      updateTrip: (id, input) =>
        run(async () => {
          await backend().updateTrip(id, input);
          setTrips((t) => t.map((x) => (x.id === id ? { ...x, ...input } : x)));
        }),
      deleteTrip: (id) =>
        run(async () => {
          await backend().deleteTrip(id);
          setTrips((t) => t.filter((x) => x.id !== id));
          setExpenses((x) => x.filter((e) => e.trip_id !== id));
        }),
      addExpenses: (inputs) => {
        const base = Date.now();
        return addBulk(
          [],
          inputs.map((i, n) => ({ ...i, id: uuid(), created_at: new Date(base + n).toISOString() })),
        );
      },
      updateExpense: (id, input) =>
        run(async () => {
          await backend().updateExpense(id, input);
          setExpenses((x) => x.map((e) => (e.id === id ? { ...e, ...input } : e)));
        }),
      deleteExpense: (id) =>
        run(async () => {
          await backend().deleteExpense(id);
          setExpenses((x) => x.filter((e) => e.id !== id));
        }),
      addBulk,
      loadSamples: () => {
        const d = sampleData();
        return addBulk(d.trips, d.expenses);
      },
      async signOut() {
        await supabase?.auth.signOut();
      },
    };
  }, [mode, authReady, userEmail, ready, error, trips, expenses, run, backend]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
