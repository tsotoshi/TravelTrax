import { CATEGORIES, type Category, type Expense } from "./types";

export interface CategorySummary {
  category: Category;
  cash: number; // counted dollars for this category, fees included
  points: number; // counted points for this category
  fees: number; // the part of `cash` that is taxes & fees
  baggage: number; // the part of `cash` that is baggage
  entries: Expense[];
  mode: "total" | "itemized";
  totalCash: number; // sum of category_total entries
  itemizedCash: number; // sum of transactions
  extraCash: number; // sum of unitemized extras
  overflow: boolean; // itemized + extras exceed the declared category total
}

export interface Summary {
  cash: number;
  points: number;
  categories: CategorySummary[];
  programs: { program: string; points: number }[];
  counted: Set<string>; // ids of entries that count toward totals
}

const sum = (xs: Expense[], f: (e: Expense) => number) => xs.reduce((s, e) => s + f(e), 0);
const round = (n: number) => Math.round(n * 100) / 100;
/** Everything paid in dollars for one entry: cash plus taxes & fees plus baggage. */
export const dollars = (e: Pick<Expense, "amount" | "fees" | "baggage">) => round(e.amount + (e.fees ?? 0) + (e.baggage ?? 0));

export const UNSPECIFIED_PROGRAM = "Unspecified program";

/**
 * Summarize the expenses of ONE trip, avoiding double counting:
 * - If a category has any "category total" entries, those totals ARE the category
 *   (transactions/extras in that category are shown as included, not added).
 * - Otherwise the category = transactions + unitemized extras.
 * Points follow the same rule.
 */
export function summarize(expenses: Expense[]): Summary {
  const counted = new Set<string>();
  const categories: CategorySummary[] = [];

  for (const { key } of CATEGORIES) {
    const entries = expenses
      .filter((e) => e.category === key)
      .sort((a, b) => entryOrder(a) - entryOrder(b) || (a.expense_date ?? "").localeCompare(b.expense_date ?? "") || a.created_at.localeCompare(b.created_at));
    if (!entries.length) continue;

    const totals = entries.filter((e) => e.entry_type === "category_total");
    const items = entries.filter((e) => e.entry_type === "transaction");
    const extras = entries.filter((e) => e.entry_type === "additional");
    const mode = totals.length ? "total" : "itemized";
    const countedEntries = mode === "total" ? totals : [...items, ...extras];
    countedEntries.forEach((e) => counted.add(e.id));

    const totalCash = round(sum(totals, dollars));
    const itemizedCash = round(sum(items, dollars));
    const extraCash = round(sum(extras, dollars));

    categories.push({
      category: key,
      cash: round(sum(countedEntries, dollars)),
      points: sum(countedEntries, (e) => e.points),
      fees: round(sum(countedEntries, (e) => e.fees ?? 0)),
      baggage: round(sum(countedEntries, (e) => e.baggage ?? 0)),
      entries,
      mode,
      totalCash,
      itemizedCash,
      extraCash,
      overflow: mode === "total" && itemizedCash + extraCash > totalCash + 0.005,
    });
  }

  const programMap = new Map<string, number>();
  for (const e of expenses) {
    if (!counted.has(e.id) || !e.points) continue;
    const p = e.program?.trim() || UNSPECIFIED_PROGRAM;
    programMap.set(p, (programMap.get(p) ?? 0) + e.points);
  }

  return {
    cash: round(categories.reduce((s, c) => s + c.cash, 0)),
    points: categories.reduce((s, c) => s + c.points, 0),
    categories,
    programs: [...programMap].map(([program, points]) => ({ program, points })).sort((a, b) => b.points - a.points),
    counted,
  };
}

function entryOrder(e: Expense) {
  return e.entry_type === "category_total" ? 0 : e.entry_type === "transaction" ? 1 : 2;
}

/** Summaries keyed by trip id (totals must never mix categories across trips). */
export function summarizeByTrip(expenses: Expense[]): Map<string, Summary> {
  const groups = new Map<string, Expense[]>();
  for (const e of expenses) {
    const g = groups.get(e.trip_id);
    if (g) g.push(e);
    else groups.set(e.trip_id, [e]);
  }
  return new Map([...groups].map(([id, list]) => [id, summarize(list)]));
}

export const EMPTY_SUMMARY: Summary = { cash: 0, points: 0, categories: [], programs: [], counted: new Set() };
