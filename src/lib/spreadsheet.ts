import { CATEGORY_MAP, ENTRY_TYPE_MAP, type Expense, type Trip } from "./types";

export type CellValue = string | number | null;
export interface Sheet {
  name: string;
  rows: CellValue[][];
}

/* ---------------- Reading ---------------- */

export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    return [{ name: file.name, rows: parseCsv(await file.text()) }];
  }
  if (!name.endsWith(".xlsx")) throw new Error("Please choose a .csv or .xlsx file.");

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheets: Sheet[] = [];
  wb.eachSheet((ws) => {
    const rows: CellValue[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const values = row.values as unknown[]; // 1-indexed
      const out: CellValue[] = [];
      for (let i = 1; i < values.length; i++) out.push(normalizeCell(values[i]));
      rows[n - 1] = out;
    });
    for (let i = 0; i < rows.length; i++) rows[i] ??= [];
    sheets.push({ name: ws.name, rows: trimEmpty(rows) });
  });
  return sheets;
}

function normalizeCell(v: unknown): CellValue {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return normalizeCell(o.result);
    if ("richText" in o && Array.isArray(o.richText)) return o.richText.map((r: { text: string }) => r.text).join("");
    if ("text" in o) return normalizeCell(o.text);
    if ("error" in o) return null;
  }
  return String(v);
}

function trimEmpty(rows: CellValue[][]) {
  const isEmpty = (r: CellValue[]) => r.every((c) => c == null || String(c).trim() === "");
  while (rows.length && isEmpty(rows[rows.length - 1])) rows.pop();
  return rows;
}

/** RFC 4180 CSV parser (quotes, escaped quotes, CRLF, BOM). Detects comma / semicolon / tab. */
export function parseCsv(text: string): CellValue[][] {
  text = text.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delim = [",", ";", "\t"].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ",");
  const rows: CellValue[][] = [];
  let row: CellValue[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return trimEmpty(rows);
}

/* ---------------- Value parsing ---------------- */

export function parseNumber(v: CellValue): number | null {
  if (v == null || String(v).trim() === "") return null;
  if (typeof v === "number") return v;
  let s = v.trim();
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()$,\s]|USD/gi, "");
  if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
  const n = Number(s);
  return neg ? -n : n;
}

export function parseDateCell(v: CellValue): string | null | undefined {
  if (v == null || String(v).trim() === "") return null;
  if (typeof v === "number") {
    // Excel serial date
    if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86_400_000).toISOString().slice(0, 10);
    return undefined;
  }
  const s = v.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // US: M/D/YYYY
  if (m) return ymd(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return undefined;
}

function ymd(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

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
  "Loyalty program",
  "Expense date",
  "Entry type",
];

function exportRows(trips: Trip[], expenses: Expense[]): CellValue[][] {
  const rows: CellValue[][] = [];
  const sorted = [...trips].sort((a, b) => a.start_date.localeCompare(b.start_date));
  for (const t of sorted) {
    const tripCells = [t.name, t.destination, t.start_date, t.end_date, t.notes ?? ""];
    const list = expenses.filter((e) => e.trip_id === t.id);
    if (!list.length) rows.push([...tripCells, "", "", null, null, "", "", ""]);
    for (const e of list)
      rows.push([
        ...tripCells,
        CATEGORY_MAP[e.category].label,
        e.description,
        e.amount,
        e.points,
        e.program ?? "",
        e.expense_date ?? "",
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
    ws.addRow(r.map((v, i) => ([2, 3, 10].includes(i) ? toDate(String(v ?? "")) : v)));
  }
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.getColumn(8).numFmt = '"$"#,##0.00';
  ws.getColumn(9).numFmt = "#,##0";
  [3, 4, 11].forEach((c) => (ws.getColumn(c).numFmt = "yyyy-mm-dd"));

  const { summarizeByTrip } = await import("./calc");
  const sums = summarizeByTrip(expenses);
  const ts = wb.addWorksheet("Trips");
  ts.columns = [
    { header: "Trip", width: 24 },
    { header: "Destination", width: 20 },
    { header: "Start", width: 12 },
    { header: "End", width: 12 },
    { header: "Cash spent (USD)", width: 16 },
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
