"use client";

import { useState, type ReactNode } from "react";
import { fmtRange, fmtShortDate, nights, pts, usd } from "@/lib/format";
import { dollars, extrasNote } from "@/lib/calc";
import {
  CATEGORIES,
  CATEGORY_MAP,
  type Category,
  type Expense,
  type ExpenseInput,
  type Trip,
} from "@/lib/types";
import { DateRangePicker } from "./DateRangePicker";
import { Icon } from "./Icon";
import { ProgramSelect } from "./ProgramSelect";

type Step = "category" | "dates" | "amounts" | "review";
interface Money {
  cash: string;
  points: string;
  fees: string;
  baggage: string;
  program: string;
}
const EMPTY: Money = { cash: "", points: "", fees: "", baggage: "", program: "" };

const isDated = (c: Category | null) => c === "flights" || c === "lodging";
const entryStep = (c: Category): Step => (isDated(c) ? "dates" : "amounts");

/** "Save & add another …" keeps the same category. */
const ANOTHER_LABEL: Record<Category, string> = {
  flights: "Save & add another flight",
  lodging: "Save & add another hotel",
  transport: "Save & add more transportation",
  activities: "Save & add another activity",
  other: "Save & add another purchase",
};

const num = (s: string) => {
  const n = Number(s.replace(/[,$\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Guided "add expense" flow: what → dates (flights/hotel) → amounts → review.
 */
export function AddExpenseWizard({
  trip,
  tripExpenses,
  programs,
  initialCategory,
  onSave,
  onClose,
}: {
  trip: Trip;
  tripExpenses: Expense[];
  programs: string[];
  initialCategory?: Category;
  onSave: (inputs: ExpenseInput[]) => Promise<void>;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<Category | null>(initialCategory ?? null);
  const [step, setStep] = useState<Step>(() => (initialCategory ? entryStep(initialCategory) : "category"));
  const [oneWay, setOneWay] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [depart, setDepart] = useState<Money>(EMPTY);
  const [ret, setRet] = useState<Money>(EMPTY);
  const [single, setSingle] = useState<Money>(EMPTY);
  const [description, setDescription] = useState("");
  const [isTotal, setIsTotal] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);



  const steps: Step[] = isDated(category) ? ["category", "dates", "amounts", "review"] : ["category", "amounts", "review"];
  const progress = steps.indexOf(step);

  function reset() {
    setCategory(null);
    setStep("category");
    setOneWay(false);
    setStart(null);
    setEnd(null);
    setDepart(EMPTY);
    setRet(EMPTY);
    setSingle(EMPTY);
    setDescription("");
    setIsTotal(true);
    setErr(null);
  }

  const go = (s: Step) => {
    setErr(null);
    setStep(s);
  };
  const back = () => {
    go(steps[steps.indexOf(step) - 1]);
  };

  /** The return flight follows the departing flight's program until it is changed. */
  const updateDepart = (m: Money) => {
    setDepart(m);
    setRet((r) => (r.program === "" || r.program === depart.program ? { ...r, program: m.program } : r));
  };

  /** The rows this answer set will create. */
  function build(): ExpenseInput[] {
    if (!category) return [];
    const base = { trip_id: trip.id, category, entry_type: "transaction" as const, end_date: null };
    const cents = (v: string) => Math.round(num(v) * 100) / 100;
    const money = (m: Money) => {
      const points = Math.round(num(m.points));
      return {
        amount: cents(m.cash),
        points,
        fees: cents(m.fees),
        baggage: category === "flights" ? cents(m.baggage) : 0,
        program: points ? m.program.trim() || null : null,
      };
    };
    if (category === "flights") {
      const route = description.trim();
      const name = (label: string) => (route ? `${label} · ${route}` : label);
      const rows: ExpenseInput[] = [{ ...base, ...money(depart), description: name(oneWay ? "Flight" : "Departing flight"), expense_date: start }];
      const r = money(ret);
      if (!oneWay && (r.amount || r.points || r.fees || r.baggage)) rows.push({ ...base, ...r, description: name("Return flight"), expense_date: end });
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
    if (!rows.length || rows.every((r) => !r.amount && !r.points && !r.fees && !r.baggage))
      return category === "flights" ? "Enter what the departing flight cost." : "Enter an amount.";
    if (rows.some((r) => r.points && !r.program))
      return rows.length > 1 ? "Choose the points program for each flight." : "Which points program were the points from?";
    return null;
  }

  async function save(another: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const rows = build();
      await onSave(rows);
      if (another && category) {
        // Same category again: clear the entry, keep the category.
        setSaved(`Saved ${rows.length > 1 ? "flights" : rows[0]?.description || CATEGORY_MAP[category].label}`);
        setSingle(EMPTY);
        setDepart(EMPTY);
        setRet(EMPTY);
        setDescription("");
        setStart(null);
        setEnd(null);
        if (category === "other") setIsTotal(false);
        go(entryStep(category));
      } else onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

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
              const count = tripExpenses.filter((e) => e.category === c.key).length;
              return (
                <button
                  key={c.key}
                  className={`tile ${c.key === "other" ? "col-span-2" : ""}`}
                  onClick={() => {
                    setCategory(c.key);
                    setSaved(null);
                    go(entryStep(c.key));
                  }}
                >
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${c.color}1f`, color: c.color }}>
                    <Icon name={c.icon} className="size-5" />
                  </span>
                  <span className="font-semibold">{c.label}</span>
                  {count > 0 && <span className="absolute top-3 right-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{count} added</span>}
                </button>
              );
            })}
          </div>
        </Prompt>
      )}

      {step === "dates" && category && (
        <Prompt
          title={category === "flights" ? "Flight dates" : "Hotel dates"}
          sub={
            start
              ? category === "flights"
                ? `Depart ${fmtShortDate(start)}${oneWay ? " · one way" : end ? ` → Return ${fmtShortDate(end)}` : " → tap return date"}`
                : end
                  ? `Check in ${fmtShortDate(start)} → Check out ${fmtShortDate(end)} · ${nights(start, end)} nights`
                  : `Check in ${fmtShortDate(start)} → tap check-out date`
              : (saved ? `✓ ${saved}. ` : "") +
                (category === "flights" ? "Tap your departure date, then your return date." : "Tap check-in, then check-out.")
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
              defaultMonth={trip.start_date}
              onChange={(s, e) => {
                setStart(s);
                setEnd(e);
              }}
            />
          </div>
          <Next disabled={!start || (!(category === "flights" && oneWay) && !end)} onClick={() => go("amounts")} />
        </Prompt>
      )}

      {step === "amounts" && category && (
        <Prompt
          title={category === "flights" ? "What did the flights cost?" : category === "lodging" ? "What did the stay cost?" : "How much was it?"}
          sub={
            category === "flights"
              ? oneWay
                ? undefined
                : "Booked as one round trip? Put the full price on the departing flight and leave the return empty."
              : category === "lodging" && start && end
                ? `${fmtRange(start, end)} · ${nights(start, end)} nights`
                : saved
                  ? `✓ ${saved}. Enter the next one.`
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
                <MoneyGroup label="Departing flight" sub={fmtShortDate(start)} value={depart} onChange={updateDepart} category={category} programs={programs} autoFocus />
                {!oneWay && <MoneyGroup label="Return flight" sub={fmtShortDate(end)} value={ret} onChange={setRet} category={category} programs={programs} />}
              </>
            ) : (
              <MoneyGroup value={single} onChange={setSingle} category={category} programs={programs} autoFocus />
            )}
            <p className="-mt-1 text-xs text-zinc-500">Leave blank anything you didn&apos;t pay. Fees are taxes &amp; fees paid in cash, e.g. on a points booking.</p>
            <div>
              <label className="label" htmlFor="wz-desc">
                {category === "flights" ? "Route (optional)" : category === "lodging" ? "Hotel name (optional)" : "Note (optional)"}
              </label>
              <input
                id="wz-desc"
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={category === "flights" ? "e.g. SFO → LIS" : category === "lodging" ? "e.g. Park Hyatt" : category === "transport" ? "e.g. Rental car" : category === "activities" ? "e.g. Museum tickets" : ""}
              />
            </div>
          </div>
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          <Next
            onClick={() => {
              const e = validateAmounts();
              if (e) setErr(e);
              else {
                setSaved(null);
                go("review");
              }
            }}
          />
        </Prompt>
      )}

      {step === "review" && category && (
        <Prompt title="Look good?" sub="Tap an entry to change it.">
          <div className="space-y-2">
            {build().map((r, i) => (
              <button
                key={i}
                className="flex w-full items-center gap-3 rounded-2xl bg-zinc-50 p-3.5 text-left transition hover:bg-zinc-100 active:scale-[0.99] dark:bg-zinc-950 dark:hover:bg-zinc-800"
                onClick={() => go("amounts")}
              >
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
                  {dollars(r) > 0 && <div className="font-semibold tabular-nums">{usd(dollars(r), true)}</div>}
                  {r.points > 0 && <div className="font-semibold tabular-nums">{pts(r.points)} pts</div>}
                  {extrasNote(dollars(r), r.fees, r.baggage) && <div className="text-xs text-zinc-500 tabular-nums">{extrasNote(dollars(r), r.fees, r.baggage)}</div>}
                </div>
              </button>
            ))}
          </div>
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          <div className="mt-6 grid gap-2">
            <button className="btn btn-primary h-12" disabled={busy} onClick={() => save(false)}>
              <Icon name="check" /> Save
            </button>
            <button className="btn btn-secondary h-12" disabled={busy} onClick={() => save(true)}>
              {category ? ANOTHER_LABEL[category] : "Save & add another"}
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
  category,
  programs,
  autoFocus,
}: {
  label?: string;
  sub?: string;
  value: Money;
  onChange: (m: Money) => void;
  category: Category;
  programs: string[];
  autoFocus?: boolean;
}) {
  const flight = category === "flights";
  const set = (k: keyof Money) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <div className={label ? "rounded-2xl p-3.5 ring-1 ring-zinc-900/8 dark:ring-white/10" : ""}>
      {label && (
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-semibold">{label}</span>
          {sub && <span className="text-xs text-zinc-500">{sub}</span>}
        </div>
      )}
      <div className={`grid gap-2.5 ${flight ? "grid-cols-2" : "grid-cols-3"}`}>
        <AmountInput label="Cash" prefix="$" value={value.cash} onChange={set("cash")} autoFocus={autoFocus} />
        <AmountInput label="Points" suffix="pts" numeric value={value.points} onChange={set("points")} />
        <AmountInput label="Fees" prefix="$" value={value.fees} onChange={set("fees")} />
        {flight && <AmountInput label="Baggage" prefix="$" value={value.baggage} onChange={set("baggage")} />}
      </div>
      <div className="mt-2.5">
        <ProgramSelect value={value.program} onChange={set("program")} programs={programs} category={category} label="" placeholder="Points program (if you used points)" />
      </div>
    </div>
  );
}

function AmountInput({
  label,
  prefix,
  suffix,
  numeric,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  numeric?: boolean;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-400">{prefix}</span>}
        <input
          className={`input h-14 text-lg font-semibold tabular-nums ${prefix ? "pl-7" : ""} ${suffix ? "pr-10" : ""}`}
          inputMode={numeric ? "numeric" : "decimal"}
          placeholder={numeric ? "0" : "0.00"}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-zinc-400">{suffix}</span>}
      </span>
    </label>
  );
}
