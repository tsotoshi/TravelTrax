"use client";

import { useId, useState } from "react";
import { fmtRange, nights } from "@/lib/format";
import { CATEGORIES, ENTRY_TYPES, ENTRY_TYPE_MAP, type Expense, type ExpenseInput } from "@/lib/types";
import { DateRangePicker } from "./DateRangePicker";
import { Icon } from "./Icon";
import { ProgramSelect } from "./ProgramSelect";

/** Full edit form for an existing entry (new entries go through AddExpenseWizard). */
export function ExpenseForm({
  expense,
  programs,
  onSubmit,
  onCancel,
  onDelete,
}: {
  expense: Expense;
  programs: string[];
  onSubmit: (input: ExpenseInput) => Promise<void>;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [d, setD] = useState({
    category: expense.category,
    entry_type: expense.entry_type,
    description: expense.description,
    amount: expense.amount ? String(expense.amount) : "",
    points: expense.points ? String(expense.points) : "",
    fees: expense.fees ? String(expense.fees) : "",
    baggage: expense.baggage ? String(expense.baggage) : "",
    program: expense.program ?? "",
    start: expense.expense_date,
    end: expense.end_date,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showCal, setShowCal] = useState(false);
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => setD((p) => ({ ...p, [k]: e.target.value }));
  const isHotel = d.category === "lodging";
  const isFlight = d.category === "flights";
  const showEntryType = d.category === "other" || d.entry_type !== "transaction";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = d.amount.trim() === "" ? 0 : Number(d.amount.replace(/[,$]/g, ""));
    const points = d.points.trim() === "" ? 0 : Math.round(Number(d.points.replace(/,/g, "")));
    const fees = d.fees.trim() === "" ? 0 : Number(d.fees.replace(/[,$]/g, ""));
    const baggage = !isFlight || d.baggage.trim() === "" ? 0 : Number(d.baggage.replace(/[,$]/g, ""));
    if (!Number.isFinite(amount) || amount < 0) return setErr("Enter a valid cash amount.");
    if (!Number.isFinite(points) || points < 0) return setErr("Enter a valid number of points.");
    if (!Number.isFinite(fees) || fees < 0) return setErr("Enter a valid fees amount.");
    if (!Number.isFinite(baggage) || baggage < 0) return setErr("Enter a valid baggage amount.");
    if (amount === 0 && points === 0 && fees === 0 && baggage === 0) return setErr("Enter cash, points, fees or baggage.");
    if (points > 0 && !d.program.trim()) return setErr("Choose the points program for these points.");
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        trip_id: expense.trip_id,
        category: d.category,
        entry_type: d.entry_type,
        description: d.description.trim(),
        amount: Math.round(amount * 100) / 100,
        points,
        fees: Math.round(fees * 100) / 100,
        baggage: Math.round(baggage * 100) / 100,
        program: points > 0 ? d.program.trim() : null,
        expense_date: d.start || null,
        end_date: isHotel ? d.end || null : null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <span className="label">Category</span>
        <div className="grid grid-cols-5 gap-1.5">
          {CATEGORIES.map((c) => {
            const on = d.category === c.key;
            return (
              <button
                type="button"
                key={c.key}
                onClick={() => setD((p) => ({ ...p, category: c.key }))}
                className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] leading-tight transition-colors ${
                  on ? "border-transparent font-semibold" : "border-edge text-muted hover:border-edge-strong hover:bg-subtle hover:text-fg"
                }`}
                style={on ? { backgroundColor: `${c.color}17`, color: c.color, boxShadow: `inset 0 0 0 1px ${c.color}` } : undefined}
                aria-pressed={on}
              >
                <Icon name={c.icon} className="size-4" />
                <span className="w-full truncate text-center">{c.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label" htmlFor={id("desc")}>Description</label>
        <input id={id("desc")} name="desc" className="input" value={d.description} onChange={set("description")} />
      </div>

      <div className={`grid gap-2.5 ${isFlight ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
        <div>
          <label className="label" htmlFor={id("amount")}>Cash</label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">$</span>
            <input id={id("amount")} name="amount" className="input pl-6 tabular-nums" inputMode="decimal" placeholder="0.00" value={d.amount} onChange={set("amount")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor={id("points")}>Points</label>
          <input id={id("points")} name="points" className="input tabular-nums" inputMode="numeric" placeholder="0" value={d.points} onChange={set("points")} />
        </div>
        <div>
          <label className="label" htmlFor={id("fees")}>Fees</label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">$</span>
            <input id={id("fees")} name="fees" className="input pl-6 tabular-nums" inputMode="decimal" placeholder="0.00" value={d.fees} onChange={set("fees")} />
          </div>
        </div>
        {isFlight && (
          <div>
            <label className="label" htmlFor={id("baggage")}>Baggage</label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">$</span>
              <input id={id("baggage")} name="baggage" className="input pl-6 tabular-nums" inputMode="decimal" placeholder="0.00" value={d.baggage} onChange={set("baggage")} />
            </div>
          </div>
        )}
      </div>
      <p className="-mt-2 text-xs text-muted">Fees are taxes &amp; fees paid in cash on a points booking. Fees{isFlight ? " and baggage" : ""} count toward dollars spent.</p>

      {d.points.trim() !== "" && d.points.trim() !== "0" && (
        <ProgramSelect id={id("program")} value={d.program} onChange={(v) => setD((p) => ({ ...p, program: v }))} programs={programs} category={d.category} />
      )}

      <div>
        <span className="label">{isHotel ? "Check-in → check-out" : "Date (optional)"}</span>
        <button type="button" className="input flex items-center justify-between text-left" onClick={() => setShowCal((s) => !s)}>
          <span className={d.start ? "tabular-nums" : "text-faint"}>
            {d.start ? (isHotel && d.end ? `${fmtRange(d.start, d.end)} · ${nights(d.start, d.end)} nights` : fmtRange(d.start, d.start)) : "Pick a date"}
          </span>
          <Icon name="calendar" className="size-4 text-faint" />
        </button>
        {showCal && (
          <div className="mt-2 animate-[fade_.15s_ease-out] rounded-xl border border-edge p-3">
            <DateRangePicker
              start={d.start}
              end={isHotel ? d.end : null}
              single={!isHotel}
              onChange={(s, e) => {
                setD((p) => ({ ...p, start: s, end: e }));
                if (!isHotel || e) setShowCal(false);
              }}
            />
            {d.start && (
              <button type="button" className="mt-1 text-xs text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => setD((p) => ({ ...p, start: null, end: null }))}>
                Clear date
              </button>
            )}
          </div>
        )}
      </div>

      {showEntryType && (
        <div>
          <span className="label">Counts as</span>
          <div className="segmented grid-cols-3">
            {ENTRY_TYPES.map((t) => (
              <button
                type="button"
                key={t.key}
                onClick={() => setD((p) => ({ ...p, entry_type: t.key }))}
                className={`segment px-1 text-xs ${d.entry_type === t.key ? "segment-on" : ""}`}
              >
                {t.key === "category_total" ? "Trip total" : t.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">{ENTRY_TYPE_MAP[d.entry_type].help}</p>
        </div>
      )}

      {err && <p className="text-[13px] text-red-600 dark:text-red-400">{err}</p>}

      <div className="flex items-center gap-2 border-t border-edge pt-4">
        <button type="button" className="btn btn-danger mr-auto" onClick={onDelete}>
          <Icon name="trash" /> Delete
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy}>
          Save
        </button>
      </div>
    </form>
  );
}
