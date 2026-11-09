"use client";

import { useId, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_MAP, COMMON_PROGRAMS, ENTRY_TYPES, ENTRY_TYPE_MAP, type Expense, type ExpenseInput } from "@/lib/types";
import { Icon } from "./Icon";

interface Draft {
  category: ExpenseInput["category"];
  entry_type: ExpenseInput["entry_type"];
  description: string;
  amount: string;
  points: string;
  program: string;
  expense_date: string;
}

const fromExpense = (e?: Expense): Draft => ({
  category: e?.category ?? "food",
  entry_type: e?.entry_type ?? "transaction",
  description: e?.description ?? "",
  amount: e ? String(e.amount) : "",
  points: e?.points ? String(e.points) : "",
  program: e?.program ?? "",
  expense_date: e?.expense_date ?? "",
});

/**
 * Used inline for fast entry (keeps category/type/date after saving so you can
 * type the next one) and inside a modal for editing.
 */
export function ExpenseForm({
  tripId,
  expense,
  programs,
  onSubmit,
  onCancel,
  compact,
}: {
  tripId: string;
  expense?: Expense;
  programs: string[];
  onSubmit: (input: ExpenseInput) => Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [d, setD] = useState<Draft>(() => fromExpense(expense));
  const [showPoints, setShowPoints] = useState(!!expense?.points || !!expense?.program);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((p) => ({ ...p, [k]: e.target.value }));

  const programOptions = [...new Set([...programs, ...COMMON_PROGRAMS])];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = d.amount.trim() === "" ? 0 : Number(d.amount);
    const points = d.points.trim() === "" ? 0 : Math.round(Number(d.points.replace(/,/g, "")));
    if (!Number.isFinite(amount) || amount < 0) return setErr("Enter a valid cash amount.");
    if (!Number.isFinite(points) || points < 0) return setErr("Enter a valid number of points.");
    if (amount === 0 && points === 0) return setErr("Enter a cash amount or points.");
    if (points > 0 && !d.program.trim()) return setErr("Choose the loyalty program for these points.");
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        trip_id: tripId,
        category: d.category,
        entry_type: d.entry_type,
        description: d.description.trim(),
        amount: Math.round(amount * 100) / 100,
        points,
        program: points > 0 || d.program.trim() ? d.program.trim() || null : null,
        expense_date: d.expense_date || null,
      });
      if (!expense) {
        setD((p) => ({ ...p, description: "", amount: "", points: "" }));
        amountRef.current?.focus();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div>
        <span className="label">Category</span>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {CATEGORIES.map((c) => {
            const on = d.category === c.key;
            return (
              <button
                type="button"
                key={c.key}
                onClick={() => setD((p) => ({ ...p, category: c.key }))}
                className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] leading-tight transition ${
                  on
                    ? "border-transparent font-medium"
                    : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                }`}
                style={on ? { backgroundColor: `${c.color}1f`, color: c.color, boxShadow: `inset 0 0 0 1.5px ${c.color}` } : undefined}
                aria-pressed={on}
              >
                <Icon name={c.icon} className="size-[18px]" />
                <span className="w-full truncate text-center">{c.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="label">Entry type</span>
        <div className="grid grid-cols-3 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {ENTRY_TYPES.map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => setD((p) => ({ ...p, entry_type: t.key }))}
              className={`rounded-lg px-2 py-1.5 text-xs font-medium transition sm:text-sm ${
                d.entry_type === t.key ? "bg-white shadow-sm dark:bg-zinc-950" : "text-zinc-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          {d.entry_type === "category_total"
            ? `Complete total for ${CATEGORY_MAP[d.category].label}. Transactions in this category will be treated as included.`
            : ENTRY_TYPE_MAP[d.entry_type].help}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-2">
          <label className="label" htmlFor={id("amount")}>Cash (USD)</label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400">$</span>
            <input
              id={id("amount")} name="amount"
              ref={amountRef}
              className="input pl-6 tabular-nums"
              inputMode="decimal"
              autoFocus={!compact}
              placeholder="0.00"
              value={d.amount}
              onChange={set("amount")}
            />
          </div>
        </div>
        <div className="col-span-3">
          <label className="label" htmlFor={id("desc")}>Description</label>
          <input
            id={id("desc")} name="desc"
            className="input"
            value={d.description}
            onChange={set("description")}
            placeholder={d.entry_type === "category_total" ? `All ${CATEGORY_MAP[d.category].label.toLowerCase()}` : "Dinner, Uber…"}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={id("date")}>Date (optional)</label>
          <input id={id("date")} name="date" type="date" className="input" value={d.expense_date} onChange={set("expense_date")} />
        </div>
        <div className="flex items-end">
          {!showPoints && (
            <button type="button" className="btn btn-secondary w-full" onClick={() => setShowPoints(true)}>
              <Icon name="star" />
              Add points
            </button>
          )}
        </div>
      </div>

      {showPoints && (
        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-2">
            <label className="label" htmlFor={id("points")}>Points redeemed</label>
            <input
              id={id("points")} name="points"
              className="input tabular-nums"
              inputMode="numeric"
              placeholder="0"
              value={d.points}
              onChange={set("points")}
            />
          </div>
          <div className="col-span-3">
            <label className="label" htmlFor={id("program")}>Loyalty program</label>
            <input
              id={id("program")} name="program"
              className="input"
              list={id("programs")}
              value={d.program}
              onChange={set("program")}
              placeholder="Marriott Bonvoy"
            />
            <datalist id={id("programs")}>
              {programOptions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {expense ? "Save changes" : (
            <>
              <Icon name="plus" /> Add expense
            </>
          )}
        </button>
      </div>
    </form>
  );
}
