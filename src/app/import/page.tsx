"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { CategoryIcon } from "@/components/ui";
import { pts, today, usd, uuid } from "@/lib/format";
import { parseDateCell, parseNumber, readSpreadsheet, type CellValue, type Sheet } from "@/lib/spreadsheet";
import { useStore } from "@/lib/store";
import { CATEGORIES, CATEGORY_MAP, ENTRY_TYPE_MAP, type Category, type EntryType, type Expense, type Trip } from "@/lib/types";

type FieldKey =
  | "trip"
  | "destination"
  | "trip_start"
  | "trip_end"
  | "trip_notes"
  | "category"
  | "description"
  | "amount"
  | "points"
  | "fees"
  | "baggage"
  | "program"
  | "date"
  | "end_date"
  | "entry_type";

// Order matters for header guessing: earlier fields claim columns first.
const FIELDS: { key: FieldKey; label: string; guess: RegExp; group: "expense" | "trip" }[] = [
  { key: "trip", label: "Trip name", guess: /^trip( name)?$/, group: "trip" },
  { key: "trip_start", label: "Trip start date", guess: /trip start|^start( date)?$/, group: "trip" },
  { key: "trip_end", label: "Trip end date", guess: /trip end|^end( date)?$/, group: "trip" },
  { key: "trip_notes", label: "Trip notes", guess: /trip notes/, group: "trip" },
  { key: "destination", label: "Destination", guess: /destination|location|city/, group: "trip" },
  { key: "entry_type", label: "Entry type", guess: /entry type|^type$|^kind$/, group: "expense" },
  { key: "category", label: "Category", guess: /categ/, group: "expense" },
  { key: "points", label: "Points redeemed", guess: /points|miles|\bpts\b/, group: "expense" },
  { key: "baggage", label: "Baggage (USD)", guess: /bag/, group: "expense" },
  { key: "fees", label: "Taxes & fees (USD)", guess: /fee|tax/, group: "expense" },
  { key: "program", label: "Loyalty program", guess: /program|loyalty|rewards/, group: "expense" },
  { key: "end_date", label: "End date (hotel check-out)", guess: /^end date$|check.?out/, group: "expense" },
  { key: "date", label: "Expense date", guess: /date|posted|^when$/, group: "expense" },
  { key: "amount", label: "Cash amount (USD)", guess: /amount|cost|price|cash|usd|total|spent|debit/, group: "expense" },
  { key: "description", label: "Description", guess: /desc|memo|merchant|item|details|payee|name|note/, group: "expense" },
];

type Mapping = Record<FieldKey, number>;

interface Parsed {
  i: number;
  tripName: string;
  destination: string;
  tripStart: string | null;
  tripEnd: string | null;
  tripNotes: string;
  category: Category;
  description: string;
  amount: number;
  points: number;
  fees: number;
  baggage: number;
  program: string | null;
  date: string | null;
  endDate: string | null;
  entryType: EntryType;
  errors: string[];
  empty: boolean;
}

const str = (v: CellValue | undefined) => (v == null ? "" : String(v).trim());

function matchCategory(v: string): Category | null {
  const s = v.toLowerCase().trim();
  if (!s) return null;
  for (const c of CATEGORIES) if (s === c.key || s === c.label.toLowerCase()) return c.key;
  if (/flight|air/.test(s)) return "flights";
  if (/hotel|lodg|accom|stay/.test(s)) return "lodging";
  if (/food|drink|dining|meal|restaurant|shop|other|misc/.test(s)) return "other";
  if (/transport|transit/.test(s)) return "transport";
  if (/event|activit|entertain|tour/.test(s)) return "activities";
  return null;
}

function matchEntryType(v: string): EntryType {
  const s = v.toLowerCase();
  if (/total/.test(s)) return "category_total";
  if (/extra|unitem|additional/.test(s)) return "additional";
  return "transaction";
}

function guessMapping(headers: string[]): Mapping {
  const m = Object.fromEntries(FIELDS.map((f) => [f.key, -1])) as Mapping;
  const used = new Set<number>();
  for (const f of FIELDS) {
    const idx = headers.findIndex((h, i) => !used.has(i) && f.guess.test(h.toLowerCase().trim()));
    if (idx >= 0) {
      m[f.key] = idx;
      used.add(idx);
    }
  }
  return m;
}

const colName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export default function ImportPage() {
  return (
    <Suspense>
      <Importer />
    </Suspense>
  );
}

function Importer() {
  const params = useSearchParams();
  const router = useRouter();
  const { trips, ready, addBulk } = useStore();

  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [targetTrip, setTargetTrip] = useState(params.get("trip") ?? "");
  const [defaultCategory, setDefaultCategory] = useState<Category>("other");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = sheets?.[sheetIdx]?.rows ?? [];
  const width = Math.max(0, ...rows.slice(0, 200).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => (hasHeader ? str(rows[0]?.[i]) : "") || `Column ${colName(i)}`);
  const data = useMemo(() => (hasHeader ? rows.slice(1) : rows), [rows, hasHeader]);

  function setupSheet(s: Sheet[], idx: number, header: boolean) {
    const r = s[idx]?.rows ?? [];
    const w = Math.max(0, ...r.slice(0, 200).map((x) => x.length));
    const hs = Array.from({ length: w }, (_, i) => (header ? str(r[0]?.[i]) : ""));
    setMapping(guessMapping(hs));
    setExcluded(new Set());
  }

  const tripByName = useMemo(() => new Map(trips.map((t) => [t.name.trim().toLowerCase(), t])), [trips]);

  const parsed: Parsed[] = useMemo(() => {
    if (!mapping) return [];
    const get = (row: CellValue[], k: FieldKey) => (mapping[k] >= 0 ? row[mapping[k]] : null);
    return data.map((row, i) => {
      const errors: string[] = [];
      const empty = row.every((c) => str(c) === "");
      const amountRaw = parseNumber(get(row, "amount"));
      const pointsRaw = parseNumber(get(row, "points"));
      const feesRaw = parseNumber(get(row, "fees"));
      const bagRaw = parseNumber(get(row, "baggage"));
      if (Number.isNaN(amountRaw)) errors.push("Invalid amount");
      else if ((amountRaw ?? 0) < 0) errors.push("Negative amount");
      if (Number.isNaN(pointsRaw)) errors.push("Invalid points");
      else if ((pointsRaw ?? 0) < 0) errors.push("Negative points");
      if (Number.isNaN(feesRaw)) errors.push("Invalid fees");
      else if ((feesRaw ?? 0) < 0) errors.push("Negative fees");
      if (Number.isNaN(bagRaw)) errors.push("Invalid baggage");
      else if ((bagRaw ?? 0) < 0) errors.push("Negative baggage");
      const baggage = Number.isNaN(bagRaw) ? 0 : Math.round((bagRaw ?? 0) * 100) / 100;
      const fees = Number.isNaN(feesRaw) ? 0 : Math.round((feesRaw ?? 0) * 100) / 100;
      const amount = Number.isNaN(amountRaw) ? 0 : Math.round((amountRaw ?? 0) * 100) / 100;
      const points = Number.isNaN(pointsRaw) ? 0 : Math.round(pointsRaw ?? 0);
      const date = parseDateCell(get(row, "date"));
      if (date === undefined) errors.push("Invalid date");
      const endDate = parseDateCell(get(row, "end_date"));
      if (endDate === undefined) errors.push("Invalid end date");
      const catText = str(get(row, "category"));
      const tripName = str(get(row, "trip"));
      if (!tripName && !targetTrip) errors.push("No trip");
      const ts = parseDateCell(get(row, "trip_start"));
      const te = parseDateCell(get(row, "trip_end"));
      return {
        i,
        tripName,
        destination: str(get(row, "destination")),
        tripStart: ts ?? null,
        tripEnd: te ?? null,
        tripNotes: str(get(row, "trip_notes")),
        category: matchCategory(catText) ?? defaultCategory,
        description: str(get(row, "description")),
        amount,
        points,
        fees,
        baggage,
        program: str(get(row, "program")) || null,
        date: date ?? null,
        endDate: endDate ?? null,
        entryType: matchEntryType(str(get(row, "entry_type"))),
        errors,
        empty: empty || (amount === 0 && points === 0 && fees === 0 && baggage === 0 && !errors.some((e) => e.startsWith("Invalid"))),
      };
    });
  }, [data, mapping, defaultCategory, targetTrip]);

  const selectable = parsed.filter((p) => !p.empty && !p.errors.length);
  const selected = selectable.filter((p) => !excluded.has(p.i));
  const newTripNames = [
    ...new Set(selected.filter((p) => p.tripName && !tripByName.has(p.tripName.toLowerCase())).map((p) => p.tripName.toLowerCase())),
  ];

  async function doImport() {
    setBusy(true);
    setErr(null);
    try {
      const now = Date.now();
      const created = new Map<string, Trip>();
      for (const key of newTripNames) {
        const rowsFor = selected.filter((p) => p.tripName.toLowerCase() === key);
        const dates = rowsFor.map((p) => p.date).filter(Boolean).sort() as string[];
        const start = rowsFor.find((p) => p.tripStart)?.tripStart ?? dates[0] ?? today();
        let end = rowsFor.find((p) => p.tripEnd)?.tripEnd ?? dates[dates.length - 1] ?? start;
        if (end < start) end = start;
        created.set(key, {
          id: uuid(),
          name: rowsFor[0].tripName,
          destination: rowsFor.find((p) => p.destination)?.destination ?? "",
          start_date: start,
          end_date: end,
          notes: rowsFor.find((p) => p.tripNotes)?.tripNotes || null,
          created_at: new Date(now).toISOString(),
        });
      }
      const expenses: Expense[] = selected.map((p, n) => ({
        id: uuid(),
        trip_id: p.tripName ? (tripByName.get(p.tripName.toLowerCase()) ?? created.get(p.tripName.toLowerCase()))!.id : targetTrip,
        category: p.category,
        description: p.description,
        amount: p.amount,
        points: p.points,
        fees: p.fees,
        baggage: p.baggage,
        program: p.program,
        expense_date: p.date,
        end_date: p.endDate,
        entry_type: p.entryType,
        created_at: new Date(now + n).toISOString(),
      }));
      await addBulk([...created.values()], expenses);
      const tripIds = [...new Set(expenses.map((e) => e.trip_id))];
      router.push(tripIds.length === 1 ? `/trips/${tripIds[0]}` : "/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed.");
      setBusy(false);
    }
  }

  const tripMapped = (mapping?.trip ?? -1) >= 0;
  const sortedTrips = [...trips].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const totalCash = selected.reduce((s, p) => s + p.amount + p.fees + p.baggage, 0);
  const totalPts = selected.reduce((s, p) => s + p.points, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="mb-8">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em]">Import expenses</h1>
        <p className="mt-0.5 text-[13px] text-muted">CSV or Excel (.xlsx). Map your columns, review the rows, then import.</p>
      </div>

      {/* 1. File */}
      <section className="card p-5">
        <StepTitle n={1}>Choose a file</StepTitle>
        <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-edge-strong bg-subtle/40 px-4 py-9 text-center transition-colors hover:border-accent hover:bg-accent-soft has-[:focus-visible]:border-accent has-[:focus-visible]:bg-accent-soft">
          <span className="mb-1 inline-flex size-9 items-center justify-center rounded-lg border border-edge bg-surface text-muted transition-colors group-hover:text-accent-ink">
            <Icon name="upload" className="size-[18px]" />
          </span>
          <span className="text-sm font-medium">{fileName || "Select a .csv or .xlsx file"}</span>
          <span className="text-xs text-muted">Tip: files exported from TravelTrax import with every column mapped.</span>
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setErr(null);
              try {
                const s = await readSpreadsheet(f);
                if (!s.length || !s.some((x) => x.rows.length)) throw new Error("That file has no rows.");
                const idx = Math.max(0, s.findIndex((x) => x.rows.length));
                setFileName(f.name);
                setSheets(s);
                setSheetIdx(idx);
                setupSheet(s, idx, hasHeader);
              } catch (x) {
                setErr(x instanceof Error ? x.message : "Couldn't read that file.");
              }
              e.target.value = "";
            }}
          />
        </label>
        {sheets && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {sheets.length > 1 && (
              <label className="flex items-center gap-2 text-[13px] text-muted">
                Sheet
                <select
                  className="input h-9 w-auto text-fg sm:h-8"
                  value={sheetIdx}
                  onChange={(e) => {
                    const i = Number(e.target.value);
                    setSheetIdx(i);
                    setupSheet(sheets, i, hasHeader);
                  }}
                >
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name} ({s.rows.length} rows)
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={hasHeader}
                onChange={(e) => {
                  setHasHeader(e.target.checked);
                  setupSheet(sheets, sheetIdx, e.target.checked);
                }}
              />
              First row contains column names
            </label>
          </div>
        )}
        {err && <p className="mt-3 text-[13px] text-red-600 dark:text-red-400">{err}</p>}
      </section>

      {sheets && mapping && (
        <>
          {/* 2. Mapping */}
          <section className="card p-5">
            <StepTitle n={2}>Map columns</StepTitle>
            <p className="-mt-1 mb-4 text-xs text-muted">Choose which spreadsheet column fills each field. Unmapped fields are left blank.</p>
            <div className="grid gap-x-5 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.filter((f) => f.group === "expense")
                .sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
                .map((f) => (
                  <MapSelect key={f.key} label={f.label} value={mapping[f.key]} headers={headers} sample={data[0]} onChange={(v) => setMapping({ ...mapping, [f.key]: v })} />
                ))}
              <div>
                <label className="label">Category when blank or unrecognized</label>
                <select className="input" value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value as Category)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 border-t border-edge pt-5">
            <h3 className="card-title mb-1">Trip</h3>
            <p className="mb-4 text-xs text-muted">
              Import everything into one trip, or map a trip-name column to split rows across trips (missing trips are created).
            </p>
            <div className="grid gap-x-5 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="label">{tripMapped ? "Trip for rows with no trip name" : "Import into trip"}</label>
                <select className="input" value={targetTrip} onChange={(e) => setTargetTrip(e.target.value)} disabled={!ready}>
                  <option value="">{tripMapped ? "— none —" : "Select a trip…"}</option>
                  {sortedTrips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.start_date.slice(0, 4)})
                    </option>
                  ))}
                </select>
              </div>
              {FIELDS.filter((f) => f.group === "trip").map((f) => (
                <MapSelect
                  key={f.key}
                  label={f.key === "trip" ? "Trip name column" : `${f.label} (new trips)`}
                  value={mapping[f.key]}
                  headers={headers}
                  sample={data[0]}
                  disabled={f.key !== "trip" && !tripMapped}
                  onChange={(v) => setMapping({ ...mapping, [f.key]: v })}
                />
              ))}
            </div>
            {!trips.length && !tripMapped && (
              <p className="mt-3 text-[13px] text-muted">
                You have no trips yet. <Link href="/" className="font-medium text-accent-ink hover:underline">Create one</Link> or map a trip-name column.
              </p>
            )}
            </div>
          </section>

          {/* 3. Preview */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
              <div>
                <StepTitle n={3} flush>Review</StepTitle>
                <p className="mt-1 text-xs text-muted tabular-nums">
                  {selected.length} of {parsed.length} rows selected · {usd(totalCash, true)} · {pts(totalPts)} pts
                  {newTripNames.length > 0 && ` · ${newTripNames.length} new trip${newTripNames.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="flex gap-1">
                <button className="btn btn-ghost h-8 text-xs sm:h-8" onClick={() => setExcluded(new Set())}>Select all</button>
                <button className="btn btn-ghost h-8 text-xs sm:h-8" onClick={() => setExcluded(new Set(parsed.map((p) => p.i)))}>Select none</button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-auto border-t border-edge">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead className="sticky top-0 z-10 bg-surface text-left text-[11px] tracking-[0.05em] text-muted uppercase shadow-[inset_0_-1px_0_var(--edge)]">
                  <tr>
                    <th className="w-10 px-4 py-2.5" />
                    {tripMapped && <th className="px-2 py-2 font-medium">Trip</th>}
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Category</th>
                    <th className="px-2 py-2 font-medium">Description</th>
                    <th className="px-2 py-2 text-right font-medium">Cash</th>
                    <th className="px-2 py-2 text-right font-medium">Fees</th>
                    <th className="px-2 py-2 text-right font-medium">Baggage</th>
                    <th className="px-2 py-2 text-right font-medium">Points</th>
                    <th className="px-2 py-2 font-medium">Program</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {parsed.map((p) => {
                    const disabled = p.empty || p.errors.length > 0;
                    const on = !disabled && !excluded.has(p.i);
                    return (
                      <tr key={p.i} className={`transition-colors hover:bg-subtle/50 ${on ? "" : "text-faint"}`}>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--accent)]"
                            disabled={disabled}
                            checked={on}
                            onChange={() =>
                              setExcluded((s) => {
                                const n = new Set(s);
                                if (n.has(p.i)) n.delete(p.i);
                                else n.add(p.i);
                                return n;
                              })
                            }
                            aria-label={`Include row ${p.i + 1}`}
                          />
                        </td>
                        {tripMapped && (
                          <td className="max-w-40 truncate px-2 py-2">
                            {p.tripName || (targetTrip ? trips.find((t) => t.id === targetTrip)?.name : "")}
                            {p.tripName && !tripByName.has(p.tripName.toLowerCase()) && (
                              <span className="badge ml-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">new</span>
                            )}
                          </td>
                        )}
                        <td className="px-2 py-2 whitespace-nowrap">{p.date ?? ""}</td>
                        <td className="px-2 py-2">
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <CategoryIcon category={p.category} size="sm" />
                            {CATEGORY_MAP[p.category].label}
                          </span>
                        </td>
                        <td className="max-w-56 px-2 py-2">
                          <div className="truncate">{p.description}</div>
                          {p.errors.length > 0 && !p.empty && <div className="text-xs text-red-600 dark:text-red-400">{p.errors.join(", ")}</div>}
                          {p.empty && <div className="text-xs">No amount or points — skipped</div>}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{p.amount ? usd(p.amount, true) : ""}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{p.fees ? usd(p.fees, true) : ""}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{p.baggage ? usd(p.baggage, true) : ""}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{p.points ? pts(p.points) : ""}</td>
                        <td className="max-w-36 truncate px-2 py-2">{p.program ?? ""}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{ENTRY_TYPE_MAP[p.entryType].label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-edge bg-subtle/40 px-5 py-3.5">
              {!tripMapped && !targetTrip && <span className="text-xs text-muted">Choose a trip above to import.</span>}
              <button className="btn btn-primary" disabled={busy || !selected.length} onClick={doImport}>
                {busy ? "Importing…" : `Import ${selected.length} row${selected.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StepTitle({ n, children, flush }: { n: number; children: React.ReactNode; flush?: boolean }) {
  return (
    <h2 className={`flex items-center gap-2.5 ${flush ? "" : "mb-4"}`}>
      <span className="inline-flex size-5 items-center justify-center rounded-md border border-edge bg-subtle text-[11px] font-semibold text-muted tabular-nums">{n}</span>
      <span className="card-title text-sm">{children}</span>
    </h2>
  );
}

const ORDER: FieldKey[] = ["date", "end_date", "category", "description", "amount", "points", "fees", "baggage", "program", "entry_type"];

function MapSelect({
  label,
  value,
  headers,
  sample,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  headers: string[];
  sample?: CellValue[];
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))}>
        <option value={-1}>— not mapped —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h}
            {sample?.[i] != null && str(sample[i]) !== "" ? `  (e.g. ${str(sample[i]).slice(0, 24)})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
