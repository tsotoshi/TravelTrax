import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sampleData } from "./sample";
import { normCategory, type Expense, type Trip, type TripInput } from "./types";

export interface Backend {
  load(): Promise<{ trips: Trip[]; expenses: Expense[] }>;
  insertTrips(trips: Trip[]): Promise<void>;
  updateTrip(id: string, patch: TripInput): Promise<void>;
  deleteTrip(id: string): Promise<void>;
  insertExpenses(expenses: Expense[]): Promise<void>;
  updateExpense(id: string, patch: Partial<Expense>): Promise<void>;
  deleteExpense(id: string): Promise<void>;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

/* ---------------- Supabase ---------------- */

const tripCols = "id,name,destination,start_date,end_date,notes,created_at";
const expenseCols = "id,trip_id,category,description,amount,points,fees,baggage,program,expense_date,end_date,entry_type,created_at";

/** Coerce numeric strings and fold legacy categories. */
const clean = (e: Expense): Expense => ({
  ...e,
  category: normCategory(e.category),
  amount: Number(e.amount),
  points: Number(e.points),
  fees: Number(e.fees ?? 0),
  baggage: Number(e.baggage ?? 0),
  end_date: e.end_date ?? null,
});

async function fetchAll<T>(sb: SupabaseClient, table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).order("created_at").range(from, from + 999);
    if (error) throw error;
    out.push(...(data as T[]));
    if (data.length < 1000) return out;
  }
}

function check<T extends { error: unknown }>(r: T) {
  if (r.error) throw r.error;
}

export function supabaseBackend(sb: SupabaseClient): Backend {
  return {
    async load() {
      const [trips, expenses] = await Promise.all([
        fetchAll<Trip>(sb, "trips", tripCols),
        fetchAll<Expense>(sb, "expenses", expenseCols),
      ]);
      return { trips, expenses: expenses.map(clean) };
    },
    async insertTrips(trips) {
      if (trips.length) check(await sb.from("trips").insert(trips));
    },
    async updateTrip(id, patch) {
      check(await sb.from("trips").update(patch).eq("id", id));
    },
    async deleteTrip(id) {
      check(await sb.from("trips").delete().eq("id", id));
    },
    async insertExpenses(expenses) {
      for (let i = 0; i < expenses.length; i += 500) check(await sb.from("expenses").insert(expenses.slice(i, i + 500)));
    },
    async updateExpense(id, patch) {
      check(await sb.from("expenses").update(patch).eq("id", id));
    },
    async deleteExpense(id) {
      check(await sb.from("expenses").delete().eq("id", id));
    },
  };
}

/* ---------------- Demo (localStorage) ---------------- */

const KEY = "traveltrax-demo-v2";

export function demoBackend(): Backend {
  let db: { trips: Trip[]; expenses: Expense[] };
  const read = () => {
    if (db) return db;
    try {
      const raw = localStorage.getItem(KEY);
      db = raw ? JSON.parse(raw) : sampleData();
    } catch {
      db = sampleData();
    }
    save();
    return db;
  };
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* storage unavailable: keep in memory */
    }
  };
  return {
    async load() {
      const d = read();
      d.expenses = d.expenses.map(clean);
      return { trips: [...d.trips], expenses: [...d.expenses] };
    },
    async insertTrips(trips) {
      read().trips.push(...trips);
      save();
    },
    async updateTrip(id, patch) {
      const d = read();
      d.trips = d.trips.map((t) => (t.id === id ? { ...t, ...patch } : t));
      save();
    },
    async deleteTrip(id) {
      const d = read();
      d.trips = d.trips.filter((t) => t.id !== id);
      d.expenses = d.expenses.filter((e) => e.trip_id !== id);
      save();
    },
    async insertExpenses(expenses) {
      read().expenses.push(...expenses);
      save();
    },
    async updateExpense(id, patch) {
      const d = read();
      d.expenses = d.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e));
      save();
    },
    async deleteExpense(id) {
      const d = read();
      d.expenses = d.expenses.filter((e) => e.id !== id);
      save();
    },
  };
}
