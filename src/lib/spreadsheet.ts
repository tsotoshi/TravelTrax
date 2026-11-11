import { CATEGORY_MAP, ENTRY_TYPE_MAP, type Expense, type Trip } from "./types";

export type CellValue = string | number | null;

/* ---------------- Export ---------------- */

export const EXPORT_HEADERS = [
  "Trip",
  "Destination",
  "Trip start",
  "Trip end",
  "Trip notes",
  "Category",
  "Description",
  "Amount (USD)",
  "Points",
  "Fees (USD)",
  "Baggage (USD)",
  "Loyalty program",
  "Expense date",
  "End date",
  "Entry type",
];

function exportRows(trips: Trip[], expenses: Expense[]): CellValue[][] {
  const rows: CellValue[][] = [];
  const sorted = [...trips].sort((a, b) => a.start_date.localeCompare(b.start_date));
  for (const t of sorted) {
    const tripCells = [t.name, t.destination, t.start_date, t.end_date, t.notes ?? ""];
    const list = expenses.filter((e) => e.trip_id === t.id);
    if (!list.length) rows.push([...tripCells, "", "", null, null, null, null, "", "", "", ""]);
    for (const e of list)
      rows.push([
        ...tripCells,
        CATEGORY_MAP[e.category].label,
        e.description,
        e.amount,
        e.points,
        e.fees,
        e.baggage,
        e.program ?? "",
        e.expense_date ?? "",
        e.end_date ?? "",
        ENTRY_TYPE_MAP[e.entry_type].label,
      ]);
  }
  return rows;
}

function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const csvCell = (v: CellValue) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCsv(filename: string, trips: Trip[], expenses: Expense[]) {
  const lines = [EXPORT_HEADERS, ...exportRows(trips, expenses)].map((r) => r.map(csvCell).join(","));
  download(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

export async function exportXlsx(filename: string, trips: Trip[], expenses: Expense[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const toDate = (s: string) => (s ? new Date(`${s}T00:00:00Z`) : null);

  const ws = wb.addWorksheet("Expenses");
  ws.columns = EXPORT_HEADERS.map((h) => ({ header: h, width: h === "Description" ? 32 : h === "Trip" ? 24 : 16 }));
  for (const r of exportRows(trips, expenses)) {
    ws.addRow(r.map((v, i) => ([2, 3, 12, 13].includes(i) ? toDate(String(v ?? "")) : v)));
  }
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.getColumn(8).numFmt = '"$"#,##0.00';
  ws.getColumn(9).numFmt = "#,##0";
  ws.getColumn(10).numFmt = ws.getColumn(11).numFmt = '"$"#,##0.00';
  [3, 4, 13, 14].forEach((c) => (ws.getColumn(c).numFmt = "yyyy-mm-dd"));

  const { summarizeByTrip } = await import("./calc");
  const sums = summarizeByTrip(expenses);
  const ts = wb.addWorksheet("Trips");
  ts.columns = [
    { header: "Trip", width: 24 },
    { header: "Destination", width: 20 },
    { header: "Start", width: 12 },
    { header: "End", width: 12 },
    { header: "Cash spent incl. fees (USD)", width: 22 },
    { header: "Points redeemed", width: 16 },
    { header: "Notes", width: 32 },
  ];
  for (const t of [...trips].sort((a, b) => a.start_date.localeCompare(b.start_date))) {
    const s = sums.get(t.id);
    ts.addRow([t.name, t.destination, toDate(t.start_date), toDate(t.end_date), s?.cash ?? 0, s?.points ?? 0, t.notes ?? ""]);
  }
  ts.getRow(1).font = { bold: true };
  ts.getColumn(3).numFmt = ts.getColumn(4).numFmt = "yyyy-mm-dd";
  ts.getColumn(5).numFmt = '"$"#,##0.00';
  ts.getColumn(6).numFmt = "#,##0";

  const buf = await wb.xlsx.writeBuffer();
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename}.xlsx`,
  );
}
