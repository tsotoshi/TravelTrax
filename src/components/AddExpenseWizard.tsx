"use client";

import { useState, type ReactNode } from "react";
import { fmtRange, fmtShortDate, nights, pts, usd } from "@/lib/format";
import {
  AIRLINE_PROGRAMS,
  BANK_PROGRAMS,
  CATEGORIES,
  CATEGORY_MAP,
  HOTEL_PROGRAMS,
  type Category,
  type Expense,
  type ExpenseInput,
  type Trip,
} from "@/lib/types";
import { DateRangePicker } from "./DateRangePicker";
import { Icon } from "./Icon";

type Pay = "cash" | "points" | "both";
type Step = "category" | "existing" | "pay" | "dates" | "amounts" | "review";
interface Money {
  cash: string;
  points: string;
}
const EMPTY: Money = { cash: "", points: "" };

const num = (s: string) => {
  const n = Number(s.replace(/[,$\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const PAY_OPTIONS: { key: Pay; title: string; sub: string; icon: string }[] = [
  { key: "cash", title: "Cash", sub: "Card or cash, in USD", icon: "wallet" },
  { key: "points", title: "Points", sub: "Miles or loyalty points", icon: "star" },
  { key: "both", title: "Cash + points", sub: "e.g. points plus taxes & fees", icon: "plus" },
];

/**
 * Guided "add expense" flow: what → how you paid → dates (flights/hotel) → amounts → review.
 */
export function AddExpenseWizard({
  trip,
  tripExpenses,
  programs,
  initialCategory,
  onSave,
  onEdit,
  onClose,
}: {
  trip: Trip;
  tripExpenses: Expense[];
  programs: string[];
  initialCategory?: Category;
  onSave: (inputs: ExpenseInput[]) => Promise<void>;
  onEdit: (e: Expense) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<Category | null>(initialCategory ?? null);
  const [step, setStep] = useState<Step>(() => (initialCategory ? firstStepFor(initialCategory) : "category"));
  const [pay, setPay] = useState<Pay | null>(null);
  const [oneWay, setOneWay] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [depart, setDepart] = useState<Money>(EMPTY);
  const [ret, setRet] = useState<Money>(EMPTY);
  const [single, setSingle] = useState<Money>(EMPTY);
  const [program, setProgram] = useState("");
  const [description, setDescription] = useState("");
  const [isTotal, setIsTotal] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  function firstStepFor(c: Category): Step {
    const has = tripExpenses.some((e) => e.category === c);
    return (c === "flights" || c === "lodging") && has ? "existing" : "pay";
  }

  const dated = category === "flights" || category === "lodging";
  const steps: Step[] = dated ? ["category", "pay", "dates", "amounts", "review"] : ["category", "pay", "amounts", "review"];
  const progress = step === "existing" ? 1 : steps.indexOf(step);

  function reset() {
    setCategory(null);
    setStep("category");
    setPay(null);
    setOneWay(false);
    setStart(null);
    setEnd(null);
    setDepart(EMPTY);
    setRet(EMPTY);
    setSingle(EMPTY);
    setDescription("");
    setProgram("");
    setIsTotal(true);
    setErr(null);
  }

  const go = (s: Step) => {
    setErr(null);
    setStep(s);
  };
  const back = () => {
    if (step === "existing" || step === "pay") return go("category");
    go(steps[steps.indexOf(step) - 1]);
  };

  const usesCash = pay === "cash" || pay === "both";
  const usesPoints = pay === "points" || pay === "both";

  /** The rows this answer set will create. */
  function build(): ExpenseInput[] {
    if (!category || !pay) return [];
    const base = { trip_id: trip.id, category, entry_type: "transaction" as const, program: usesPoints ? program.trim() || null : null, end_date: null };
    const money = (m: Money) => ({ amount: usesCash ? Math.round(num(m.cash) * 100) / 100 : 0, points: usesPoints ? Math.round(num(m.points)) : 0 });
    if (category === "flights") {
      const rows: ExpenseInput[] = [{ ...base, ...money(depart), description: "Departing flight", expense_date: start }];
      const r = money(ret);
      if (!oneWay && (r.amount || r.points)) rows.push({ ...base, ...r, description: "Return flight", expense_date: end });
      return rows;
    }
    if (category === "lodging")
      return [{ ...base, ...money(single), description: description.trim() || "Hotel stay", expense_date: start, end_date: end }];
    return [
      {
        ...base,
        ...money(single),
        description: description.trim() || (category === "other" && isTotal ? "Food, shopping & other" : CATEGORY_MAP[category].label),
        expense_date: null,
        entry_type: category === "other" && isTotal ? "category_total" : "transaction",
      },
    ];
  }

  function validateAmounts(): string | null {
    const rows = build();
    if (!rows.length || rows.every((r) => !r.amount && !r.points))
      return category === "flights" ? "Enter what the departing flight cost." : "Enter an amount.";
    if (usesPoints && rows.some((r) => r.points) && !program.trim()) return "Which loyalty program were the points from?";
    return null;
  }

  async function save(another: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const rows = build();
      await onSave(rows);
      if (another) {
        setSaved(`Saved ${CATEGORY_MAP[category!].label.toLowerCase()}`);
        reset();
      } else onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const programChoices = [
    ...new Set([
      ...programs,
      ...(category === "flights" ? AIRLINE_PROGRAMS : category === "lodging" ? HOTEL_PROGRAMS : []),
      ...BANK_PROGRAMS,
    ]),
  ].slice(0, 10);

  return (
    <div>
      {/* Progress */}
      <div className="mb-5 flex items-center gap-3">
        {step !== "category" && (
          <button className="btn btn-ghost -ml-2 size-9 rounded-full px-0" onClick={back} aria-label="Back">
            <Icon name="back" />
          </button>
        )}
        <div className="flex flex-1 gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition ${i <= progress ? "bg-[var(--accent)]" : "bg-zinc-200 dark:bg-zinc-800"}`} />
          ))}
        </div>
      </div>

      {step === "category" && (
        <Prompt title="What did you spend on?" sub={saved ? `✓ ${saved}. Add another?` : trip.name}>
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIES.map((c) => {
              const done = (c.key === "flights" || c.key === "lodging") && tripExpenses.some((e) => e.category === c.key);
              return (
                <button
                  key={c.key}
                  className={`tile ${c.key === "other" ? "col-span-2" : ""}`}
                  onClick={() => {
                    setCategory(c.key);
                    setSaved(null);
                    go(firstStepFor(c.key));
                  }}
                >
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${c.color}1f`, color: c.color }}>
                    <Icon name={c.icon} className="size-5" />
                  </span>
                  <span className="font-semibold">{c.label}</span>
                  {done && <span className="absolute top-3 right-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Added</span>}
                </button>
              );
            })}
          </div>
        </Prompt>
      )}

      {step === "existing" && category && (
        <Prompt
          title={category === "flights" ? "Flights are already added" : "Your hotel is already added"}
          sub={`Tap one to edit it. Multiple ${category === "flights" ? "flights" : "hotels"} per trip are coming in V2.`}
        >
          <div className="space-y-2">
            {tripExpenses
              .filter((e) => e.category === category)
              .map((e) => (
                <button key={e.id} className="tile flex-row items-center justify-between text-left" onClick={() => onEdit(e)}>
                  <span>
                    <span className="block font-semibold">{e.description || CATEGORY_MAP[category].label}</span>
                    <span className="text-xs text-zinc-500">
                      {e.end_date && e.expense_date ? fmtRange(e.expense_date, e.end_date) : fmtShortDate(e.expense_date)}
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    {e.amount > 0 && <span className="block font-semibold">{usd(e.amount, true)}</span>}
                    {e.points > 0 && <span className="block text-xs text-zinc-500">{pts(e.points)} pts</span>}
                  </span>
                </button>
              ))}
          </div>
          <button className="mt-4 text-sm text-zinc-500 underline" onClick={() => go("pay")}>
            Add another anyway
          </button>
        </Prompt>
      )}

      {step === "pay" && category && (
        <Prompt title="How did you pay?" sub={CATEGORY_MAP[category].label}>
          <div className="space-y-2.5">
            {PAY_OPTIONS.map((o) => (
              <button
                key={o.key}
                className={`tile flex-row items-center gap-4 text-left ${pay === o.key ? "tile-on" : ""}`}
                onClick={() => {
                  setPay(o.key);
                  go(dated ? "dates" : "amounts");
                }}
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Icon name={o.icon} className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{o.title}</span>
                  <span className="text-sm text-zinc-500">{o.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </Prompt>
      )}

      {step === "dates" && category && (
        <Prompt
          title={category === "flights" ? "When are you flying?" : "When are you staying?"}
          sub={
            start
              ? category === "flights"
                ? `Depart ${fmtShortDate(start)}${oneWay ? " · one way" : end ? ` → Return ${fmtShortDate(end)}` : " → tap return date"}`
                : end
                  ? `Check in ${fmtShortDate(start)} → Check out ${fmtShortDate(end)} · ${nights(start, end)} nights`
                  : `Check in ${fmtShortDate(start)} → tap check-out date`
              : category === "flights"
                ? "Tap your departure date, then your return date."
                : "Tap check-in, then check-out."
          }
        >
          <button
            className="tile mb-3 flex-row items-center gap-3 text-left"
            onClick={() => {
              setStart(trip.start_date);
              setEnd(oneWay ? null : trip.end_date);
            }}
          >
            <Icon name="calendar" className="size-5 text-[var(--accent)]" />
            <span className="flex-1">
              <span className="block font-semibold">Use trip dates</span>
              <span className="text-sm text-zinc-500">{fmtRange(trip.start_date, trip.end_date)}</span>
            </span>
            {start === trip.start_date && (oneWay || end === trip.end_date) && <Icon name="check" className="size-5 text-[var(--accent)]" />}
          </button>
          {category === "flights" && (
            <div className="mb-3 grid grid-cols-2 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
              {[false, true].map((ow) => (
                <button
                  key={String(ow)}
                  className={`rounded-xl py-2 text-sm font-medium transition ${oneWay === ow ? "bg-white shadow-sm dark:bg-zinc-950" : "text-zinc-500"}`}
                  onClick={() => {
                    setOneWay(ow);
                    if (ow) setEnd(null);
                  }}
                >
                  {ow ? "One way" : "Round trip"}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-2xl p-3 ring-1 ring-zinc-900/5 dark:ring-white/10">
            <DateRangePicker
              start={start}
              end={end}
              single={category === "flights" && oneWay}
              onChange={(s, e) => {
                setStart(s);
                setEnd(e);
              }}
            />
          </div>
          <Next disabled={!start || (!(category === "flights" && oneWay) && !end)} onClick={() => go("amounts")} />
        </Prompt>
      )}

      {step === "amounts" && category && pay && (
        <Prompt
          title={category === "flights" ? "What did the flights cost?" : category === "lodging" ? "What did the stay cost?" : "How much was it?"}
          sub={
            category === "flights"
              ? oneWay
                ? undefined
                : "Booked as one round trip? Put the full price on the departing flight and leave the return empty."
              : category === "lodging" && start && end
                ? `${fmtRange(start, end)} · ${nights(start, end)} nights`
                : undefined
          }
        >
          <div className="space-y-4">
            {category === "other" && (
              <div className="grid grid-cols-2 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
                {[true, false].map((t) => (
                  <button
                    key={String(t)}
                    className={`rounded-xl py-2 text-sm font-medium transition ${isTotal === t ? "bg-white shadow-sm dark:bg-zinc-950" : "text-zinc-500"}`}
                    onClick={() => setIsTotal(t)}
                  >
                    {t ? "Total for the trip" : "One purchase"}
                  </button>
                ))}
              </div>
            )}
            {category === "flights" ? (
              <>
                <MoneyGroup label="Departing flight" sub={fmtShortDate(start)} value={depart} onChange={setDepart} cash={usesCash} points={usesPoints} autoFocus />
                {!oneWay && <MoneyGroup label="Return flight" sub={fmtShortDate(end)} value={ret} onChange={setRet} cash={usesCash} points={usesPoints} />}
              </>
            ) : (
              <MoneyGroup value={single} onChange={setSingle} cash={usesCash} points={usesPoints} autoFocus />
            )}
            {usesPoints && (
              <div>
                <span className="label">Which program?</span>
                <div className="flex flex-wrap gap-1.5">
                  {programChoices.map((p) => (
                    <button key={p} className={`chip ${program === p ? "chip-on" : ""}`} onClick={() => setProgram(p)}>
                      {p}
                    </button>
                  ))}
                </div>
                <input className="input mt-2" placeholder="Or type another program" value={programChoices.includes(program) ? "" : program} onChange={(e) => setProgram(e.target.value)} />
              </div>
            )}
            {category !== "flights" && (
              <div>
                <label className="label" htmlFor="wz-desc">
                  {category === "lodging" ? "Hotel name (optional)" : "Note (optional)"}
                </label>
                <input
                  id="wz-desc"
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={category === "lodging" ? "e.g. Park Hyatt" : category === "transport" ? "e.g. Rental car" : category === "activities" ? "e.g. Museum tickets" : ""}
                />
              </div>
            )}
          </div>
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          <Next
            onClick={() => {
              const e = validateAmounts();
              if (e) setErr(e);
              else go("review");
            }}
          />
        </Prompt>
      )}

      {step === "review" && category && (
        <Prompt title="Look good?" sub="You can edit any entry later by tapping it.">
          <div className="space-y-2">
            {build().map((r, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-3.5 dark:bg-zinc-950">
                <span className="inline-flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${CATEGORY_MAP[category].color}1f`, color: CATEGORY_MAP[category].color }}>
                  <Icon name={CATEGORY_MAP[category].icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.description}</div>
                  <div className="text-xs text-zinc-500">
                    {[
                      r.end_date && r.expense_date ? `${fmtRange(r.expense_date, r.end_date)} · ${nights(r.expense_date, r.end_date)} nights` : fmtShortDate(r.expense_date),
                      r.entry_type === "category_total" ? "Trip total" : null,
                      r.points ? r.program : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="text-right">
                  {r.amount > 0 && <div className="font-semibold tabular-nums">{usd(r.amount, true)}</div>}
                  {r.points > 0 && <div className="text-xs text-zinc-500 tabular-nums">{pts(r.points)} pts</div>}
                </div>
              </div>
            ))}
          </div>
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          <div className="mt-6 grid gap-2">
            <button className="btn btn-primary h-12" disabled={busy} onClick={() => save(false)}>
              <Icon name="check" /> Save
            </button>
            <button className="btn btn-secondary h-12" disabled={busy} onClick={() => save(true)}>
              Save &amp; add another
            </button>
          </div>
        </Prompt>
      )}
    </div>
  );
}

function Prompt({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="animate-[fade_.2s_ease-out]">
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      {sub && <p className="mt-1 text-sm text-zinc-500">{sub}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Next({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className="btn btn-primary mt-6 h-12 w-full" disabled={disabled} onClick={onClick}>
      Continue
    </button>
  );
}

function MoneyGroup({
  label,
  sub,
  value,
  onChange,
  cash,
  points,
  autoFocus,
}: {
  label?: string;
  sub?: string;
  value: Money;
  onChange: (m: Money) => void;
  cash: boolean;
  points: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      {label && (
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-semibold">{label}</span>
          {sub && <span className="text-xs text-zinc-500">{sub}</span>}
        </div>
      )}
      <div className={`grid gap-2.5 ${cash && points ? "grid-cols-2" : ""}`}>
        {cash && (
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-400">$</span>
            <input
              className="input h-14 pl-8 text-lg font-semibold tabular-nums"
              inputMode="decimal"
              placeholder={points ? "Taxes & fees" : "0.00"}
              value={value.cash}
              autoFocus={autoFocus}
              onChange={(e) => onChange({ ...value, cash: e.target.value })}
              aria-label={`${label ?? "Cash"} amount in USD`}
            />
          </div>
        )}
        {points && (
          <div className="relative">
            <input
              className="input h-14 pr-12 text-lg font-semibold tabular-nums"
              inputMode="numeric"
              placeholder="Points"
              value={value.points}
              autoFocus={autoFocus && !cash}
              onChange={(e) => onChange({ ...value, points: e.target.value })}
              aria-label={`${label ?? ""} points`}
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-zinc-400">pts</span>
          </div>
        )}
      </div>
    </div>
  );
}
