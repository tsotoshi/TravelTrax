import { uuid } from "./format";
import type { Category, EntryType, Expense, Trip } from "./types";

// [category, description, cash, points, program, date, endDate, entryType]
type Row = [Category, string, number, number, string | null, string | null, string | null, EntryType?];

const DATA: { trip: Omit<Trip, "id" | "created_at">; rows: Row[] }[] = [
  {
    trip: { name: "Banff Ski Week", destination: "Banff, Alberta, Canada", start_date: "2026-02-14", end_date: "2026-02-21", notes: "Sunshine Village + Lake Louise" },
    rows: [
      ["flights", "Departing flight", 320, 0, null, "2026-02-14", null],
      ["flights", "Return flight", 320, 0, null, "2026-02-21", null],
      ["lodging", "Mountain condo", 1900, 0, null, "2026-02-14", "2026-02-21"],
      ["transport", "Rental car", 420, 0, null, null, null],
      ["activities", "Lift tickets ×5 days", 980, 0, null, null, null],
      ["other", "Food, shopping & other", 785, 0, null, null, null, "category_total"],
    ],
  },
  {
    trip: { name: "Lisbon & Porto", destination: "Lisbon, Portugal", start_date: "2025-09-12", end_date: "2025-09-20", notes: null },
    rows: [
      ["flights", "Departing flight", 89.5, 60000, "Aeroplan", "2025-09-12", null],
      ["flights", "Return flight", 512, 0, null, "2025-09-20", null],
      ["lodging", "Porto hotel", 0, 54000, "Marriott Bonvoy", "2025-09-17", "2025-09-20"],
      ["transport", "Train Lisbon → Porto", 45, 0, null, null, null],
      ["activities", "Port wine tasting", 38, 0, null, null, null],
      ["other", "Food, shopping & other", 520, 0, null, null, null, "category_total"],
    ],
  },
  {
    trip: { name: "Tokyo in Spring", destination: "Tokyo, Japan", start_date: "2025-03-28", end_date: "2025-04-06", notes: "Cherry blossom season" },
    rows: [
      ["flights", "Departing flight", 5.6, 40000, "United MileagePlus", "2025-03-28", null],
      ["flights", "Return flight", 5.6, 40000, "United MileagePlus", "2025-04-06", null],
      ["lodging", "Tokyo Marriott", 0, 150000, "Marriott Bonvoy", "2025-03-28", "2025-04-06"],
      ["transport", "Shinkansen to Kyoto", 210, 0, null, null, null],
      ["activities", "teamLab Planets", 28, 0, null, null, null],
      ["other", "Food, shopping & other", 670, 0, null, null, null, "category_total"],
    ],
  },
  {
    trip: { name: "NYC Weekend", destination: "New York, New York, United States", start_date: "2024-12-06", end_date: "2024-12-08", notes: null },
    rows: [
      ["flights", "Departing flight", 0, 12500, "Chase Ultimate Rewards", "2024-12-06", null],
      ["flights", "Return flight", 0, 12500, "Chase Ultimate Rewards", "2024-12-08", null],
      ["lodging", "Hotel", 0, 45000, "World of Hyatt", "2024-12-06", "2024-12-08"],
      ["transport", "Uber", 30, 0, null, null, null],
      ["activities", "Broadway tickets", 180, 0, null, null, null],
      ["other", "Dinner in the West Village", 45, 0, null, null, null],
    ],
  },
];

export function sampleData(): { trips: Trip[]; expenses: Expense[] } {
  const now = Date.now();
  const trips: Trip[] = [];
  const expenses: Expense[] = [];
  for (const { trip, rows } of DATA) {
    const id = uuid();
    trips.push({ ...trip, id, created_at: new Date(now).toISOString() });
    rows.forEach(([category, description, amount, points, program, date, endDate, entry_type = "transaction"], i) =>
      expenses.push({
        id: uuid(),
        trip_id: id,
        category,
        description,
        amount,
        points,
        program,
        expense_date: date,
        end_date: endDate,
        entry_type,
        created_at: new Date(now + i).toISOString(),
      }),
    );
  }
  return { trips, expenses };
}
