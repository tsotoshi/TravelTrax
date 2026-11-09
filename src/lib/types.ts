/** V1 categories. Legacy "food" / "shopping" values are folded into "other". */
export type Category = "flights" | "lodging" | "transport" | "activities" | "other";

const CATEGORY_KEYS = ["flights", "lodging", "transport", "activities", "other"];
export function normCategory(c: string): Category {
  return (CATEGORY_KEYS.includes(c) ? c : "other") as Category;
}

export type EntryType = "transaction" | "category_total" | "additional";

export interface Trip {
  id: string;
  name: string;
  destination: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  category: Category;
  description: string;
  amount: number; // USD
  points: number;
  program: string | null;
  expense_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD, e.g. hotel check-out
  entry_type: EntryType;
  created_at: string;
}

export type TripInput = Pick<Trip, "name" | "destination" | "start_date" | "end_date" | "notes">;
export type ExpenseInput = Omit<Expense, "id" | "created_at">;

export type IconName =
  | "plane"
  | "bed"
  | "utensils"
  | "car"
  | "ticket"
  | "bag"
  | "dots";

export const CATEGORIES: { key: Category; label: string; short: string; color: string; icon: IconName }[] = [
  { key: "flights", label: "Flights", short: "Flights", color: "#0ea5e9", icon: "plane" },
  { key: "lodging", label: "Hotel", short: "Hotel", color: "#6366f1", icon: "bed" },
  { key: "transport", label: "Transportation", short: "Transport", color: "#10b981", icon: "car" },
  { key: "activities", label: "Activities & events", short: "Activities", color: "#f43f5e", icon: "ticket" },
  { key: "other", label: "Food, shopping & other", short: "Food & other", color: "#f59e0b", icon: "bag" },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<
  Category,
  (typeof CATEGORIES)[number]
>;

export const ENTRY_TYPES: { key: EntryType; label: string; short: string; help: string }[] = [
  {
    key: "transaction",
    label: "Transaction",
    short: "Item",
    help: "A single purchase, e.g. a $45 dinner or a $30 Uber.",
  },
  {
    key: "category_total",
    label: "Category total",
    short: "Total",
    help: "The complete total for this category. Transactions in the same category are treated as included, not added again.",
  },
  {
    key: "additional",
    label: "Unitemized extra",
    short: "Extra",
    help: "Spending you didn't itemize, added on top of transactions (e.g. $200 of misc. snacks).",
  },
];

export const ENTRY_TYPE_MAP = Object.fromEntries(ENTRY_TYPES.map((t) => [t.key, t])) as Record<
  EntryType,
  (typeof ENTRY_TYPES)[number]
>;

export const AIRLINE_PROGRAMS = [
  "United MileagePlus",
  "American AAdvantage",
  "Delta SkyMiles",
  "Aeroplan",
  "Alaska Mileage Plan",
  "British Airways Avios",
];
export const HOTEL_PROGRAMS = ["Marriott Bonvoy", "Hilton Honors", "World of Hyatt", "IHG One Rewards"];
export const BANK_PROGRAMS = [
  "Chase Ultimate Rewards",
  "Amex Membership Rewards",
  "Capital One Miles",
  "Citi ThankYou Points",
];
export const COMMON_PROGRAMS = [...HOTEL_PROGRAMS, ...AIRLINE_PROGRAMS, ...BANK_PROGRAMS];
