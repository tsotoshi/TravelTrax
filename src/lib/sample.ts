import { uuid } from "./format";
import type { Category, EntryType, Expense, Trip } from "./types";

type Row = [Category, string, number, number?, string?, string?, EntryType?];

const DATA: { trip: Omit<Trip, "id" | "created_at">; rows: Row[] }[] = [
  {
    trip: { name: "Banff Ski Week", destination: "Banff, Canada", start_date: "2026-02-14", end_date: "2026-02-21", notes: "Sunshine Village + Lake Louise" },
    rows: [
      ["flights", "SFO ⇄ YYC", 640, 0, undefined, "2025-11-02"],
      ["lodging", "Condo, 7 nights", 1900, 0, undefined, undefined, "category_total"],
      ["food", "All food & drinks", 700, 0, undefined, undefined, "category_total"],
      ["food", "Fondue night", 165, 0, undefined, "2026-02-17"],
      ["transport", "Rental car", 420, 0, undefined, "2026-02-14"],
      ["activities", "Lift tickets ×5 days", 980, 0, undefined, "2026-02-15"],
      ["shopping", "Goggles", 85, 0, undefined, "2026-02-16"],
    ],
  },
  {
    trip: { name: "Lisbon & Porto", destination: "Portugal", start_date: "2025-09-12", end_date: "2025-09-20", notes: null },
    rows: [
      ["flights", "SFO → LIS (award)", 89.5, 60000, "Aeroplan", "2025-05-10"],
      ["flights", "OPO → SFO", 512, 0, undefined, "2025-05-10"],
      ["lodging", "Lisbon apartment, 5 nights", 890, 0, undefined, "2025-09-12"],
      ["lodging", "Porto hotel, 3 nights", 0, 54000, "Marriott Bonvoy", "2025-09-17"],
      ["food", "Pastéis & coffee", 24, 0, undefined, "2025-09-13"],
      ["food", "Seafood dinner, Cascais", 112, 0, undefined, "2025-09-14"],
      ["food", "Unitemized meals & snacks", 260, 0, undefined, undefined, "additional"],
      ["transport", "Train Lisbon → Porto", 45, 0, undefined, "2025-09-17"],
      ["transport", "Uber to airport", 30, 0, undefined, "2025-09-20"],
      ["activities", "Port wine tasting", 38, 0, undefined, "2025-09-18"],
      ["shopping", "Ceramics", 74, 0, undefined, "2025-09-19"],
    ],
  },
  {
    trip: { name: "Tokyo in Spring", destination: "Tokyo, Japan", start_date: "2025-03-28", end_date: "2025-04-06", notes: "Cherry blossom season" },
    rows: [
      ["flights", "SFO ⇄ HND (award)", 11.2, 80000, "United MileagePlus", "2024-11-20"],
      ["lodging", "Marriott, 4 nights", 0, 150000, "Marriott Bonvoy", "2025-03-28"],
      ["lodging", "Ryokan in Hakone, 1 night", 620, 0, undefined, "2025-04-01"],
      ["lodging", "Boutique hotel, 4 nights", 0, 60000, "Chase Ultimate Rewards", "2025-04-02"],
      ["food", "All food (from card statement)", 520, 0, undefined, undefined, "category_total"],
      ["food", "Omakase dinner", 145, 0, undefined, "2025-03-30"],
      ["food", "Ramen", 18, 0, undefined, "2025-03-29"],
      ["transport", "Suica top-ups", 40, 0, undefined, "2025-03-28"],
      ["transport", "Shinkansen to Kyoto", 210, 0, undefined, "2025-04-03"],
      ["activities", "teamLab Planets", 28, 0, undefined, "2025-03-31"],
      ["shopping", "Souvenirs (unitemized)", 150, 0, undefined, undefined, "additional"],
    ],
  },
  {
    trip: { name: "NYC Weekend", destination: "New York, NY", start_date: "2024-12-06", end_date: "2024-12-08", notes: null },
    rows: [
      ["flights", "SFO ⇄ JFK", 0, 25000, "Chase Ultimate Rewards", "2024-10-01"],
      ["lodging", "Hotel, 2 nights", 0, 45000, "World of Hyatt", "2024-12-06"],
      ["food", "Dinner in the West Village", 45, 0, undefined, "2024-12-06"],
      ["food", "Bagels & coffee", 22, 0, undefined, "2024-12-07"],
      ["transport", "Uber", 30, 0, undefined, "2024-12-06"],
      ["activities", "Broadway tickets", 180, 0, undefined, "2024-12-07"],
    ],
  },
];

export function sampleData(): { trips: Trip[]; expenses: Expense[] } {
  const now = new Date().toISOString();
  const trips: Trip[] = [];
  const expenses: Expense[] = [];
  for (const { trip, rows } of DATA) {
    const id = uuid();
    trips.push({ ...trip, id, created_at: now });
    rows.forEach(([category, description, amount, points = 0, program, date, entry_type = "transaction"], i) =>
      expenses.push({
        id: uuid(),
        trip_id: id,
        category,
        description,
        amount,
        points,
        program: program ?? null,
        expense_date: date ?? null,
        entry_type,
        created_at: new Date(Date.parse(now) + i).toISOString(),
      }),
    );
  }
  return { trips, expenses };
}
