"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AddExpenseWizard } from "@/components/AddExpenseWizard";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Icon } from "@/components/Icon";
import { TripForm } from "@/components/TripForm";
import { BarList, CategoryIcon, EmptyState, ExportMenu, Modal } from "@/components/ui";
import { summarize, type CategorySummary } from "@/lib/calc";
import { compact, fmtRange, fmtShortDate, nights, pts, usd, usdShort } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CATEGORY_MAP, ENTRY_TYPE_MAP, type Category, type Expense } from "@/lib/types";

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { trips, expenses, ready, updateTrip, deleteTrip, addExpenses, updateExpense, deleteExpense } = useStore();
  const [editingTrip, setEditingTrip] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [wizard, setWizard] = useState<{ category?: Category } | null>(null);

  // Opened right after creating a trip: jump straight into the guided flow.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add") === "1") {
      setWizard({});
      router.replace(`/trips/${id}`);
    }
  }, [id, router]);

  const trip = trips.find((t) => t.id === id);
  const list = useMemo(() => expenses.filter((e) => e.trip_id === id), [expenses, id]);
  const s = useMemo(() => summarize(list), [list]);
  const programs = useMemo(() => [...new Set(expenses.map((e) => e.program).filter(Boolean) as string[])], [expenses]);

  if (!ready) return <div className="h-48 animate-pulse rounded-3xl bg-zinc-200 dark:bg-zinc-800" />;
  if (!trip)
    return (
      <EmptyState icon="map" title="Trip not found">
        <Link href="/" className="text-[var(--accent)]">Back to dashboard</Link>
      </EmptyState>
    );

  const n = nights(trip.start_date, trip.end_date);
  const missing = (["flights", "lodging"] as const).filter((c) => !list.some((e) => e.category === c));

  const onDeleteExpense = async (e: Expense) => {
    if (!confirm(`Delete "${e.description || CATEGORY_MAP[e.category].label}"?`)) return;
    await deleteExpense(e.id);
    setEditing(null);
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        <Icon name="back" className="size-3.5" /> All trips
      </Link>

      {/* Hero */}
      <section className="hero p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{trip.name}</h1>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/80">
              {trip.destination && (
                <span className="flex items-center gap-1">
                  <Icon name="pin" className="size-3.5" /> {trip.destination}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Icon name="calendar" className="size-3.5" /> {fmtRange(trip.start_date, trip.end_date)}
                {n > 0 && ` · ${n} nights`}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Link href={`/import?trip=${trip.id}`} className="btn btn-glass size-10 px-0" title="Import expenses" aria-label="Import expenses">
              <Icon name="upload" />
            </Link>
            <ExportMenu filename={slug(trip.name)} trips={[trip]} expenses={list} buttonClass="btn btn-glass size-10 px-0" iconOnly />
            <button className="btn btn-glass size-10 px-0" onClick={() => setEditingTrip(true)} title="Edit trip" aria-label="Edit trip">
              <Icon name="pencil" />
            </button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <HeroStat label="Cash" value={usdShort(s.cash)} />
          <HeroStat label="Points" value={compact(s.points)} />
          <HeroStat label="Per day" value={usdShort(s.cash / Math.max(n + 1, 1))} />
        </div>
        {trip.notes && <p className="mt-4 text-sm whitespace-pre-line text-white/80">{trip.notes}</p>}
      </section>

      <button className="btn btn-primary hidden h-12 w-full text-base lg:flex" onClick={() => setWizard({})}>
        <Icon name="plus" className="size-5" /> Add expense
      </button>

      {missing.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">Next up</h2>
          <div className="grid grid-cols-2 gap-3">
            {missing.map((c) => (
              <button key={c} className="tile flex-row items-center gap-3 text-left" onClick={() => setWizard({ category: c })}>
                <CategoryIcon category={c} />
                <span>
                  <span className="block font-semibold">Add {c === "flights" ? "flights" : "hotel"}</span>
                  <span className="text-xs text-zinc-500">{c === "flights" ? "Depart & return" : "Your stay"}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {s.categories.length === 0 ? (
            <EmptyState icon="wallet" title="No expenses yet">
              Tap <b>Add expense</b> and we&apos;ll walk you through it.
            </EmptyState>
          ) : (
            s.categories.map((c) => <CategorySection key={c.category} c={c} counted={s.counted} onEdit={setEditing} />)
          )}
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold">By category</h2>
            <BarList
              empty="No spending yet"
              items={s.categories.map((c) => ({
                key: c.category,
                label: (
                  <span className="flex items-center gap-2">
                    <CategoryIcon category={c.category} size="sm" /> {CATEGORY_MAP[c.category].label}
                  </span>
                ),
                value: c.cash,
                display: usd(c.cash),
                sub: s.cash ? `${Math.round((c.cash / s.cash) * 100)}%` : undefined,
                color: CATEGORY_MAP[c.category].color,
              }))}
            />
          </section>
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold">Points by program</h2>
            <BarList empty="No points redeemed" items={s.programs.map((p) => ({ key: p.program, label: p.program, value: p.points, display: pts(p.points) }))} />
          </section>
          <button
            className="btn btn-ghost w-full text-red-600 dark:text-red-400"
            onClick={async () => {
              if (!confirm(`Delete "${trip.name}" and all ${list.length} expenses? This can't be undone.`)) return;
              await deleteTrip(trip.id);
              router.push("/");
            }}
          >
            <Icon name="trash" /> Delete trip
          </button>
        </aside>
      </div>

      <button
        className="btn btn-primary fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 h-14 text-base shadow-xl shadow-indigo-500/25 lg:hidden"
        onClick={() => setWizard({})}
      >
        <Icon name="plus" className="size-5" /> Add expense
      </button>

      {wizard && (
        <Modal title="Add expense" onClose={() => setWizard(null)} wide>
          <AddExpenseWizard
            trip={trip}
            tripExpenses={list}
            programs={programs}
            initialCategory={wizard.category}
            onSave={addExpenses}
            onEdit={(e) => {
              setWizard(null);
              setEditing(e);
            }}
            onClose={() => setWizard(null)}
          />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit expense" onClose={() => setEditing(null)}>
          <ExpenseForm
            expense={editing}
            programs={programs}
            onCancel={() => setEditing(null)}
            onDelete={() => onDeleteExpense(editing)}
            onSubmit={async (input) => {
              await updateExpense(editing.id, input);
              setEditing(null);
            }}
          />
        </Modal>
      )}
      {editingTrip && (
        <Modal title="Edit trip" onClose={() => setEditingTrip(false)} wide>
          <TripForm
            trip={trip}
            onCancel={() => setEditingTrip(false)}
            onSubmit={async (input) => {
              await updateTrip(trip.id, input);
              setEditingTrip(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-3 py-2.5 backdrop-blur-sm">
      <div className="text-[11px] font-medium tracking-wide text-white/70 uppercase">{label}</div>
      <div className="mt-0.5 truncate text-lg font-semibold tabular-nums sm:text-xl">{value}</div>
    </div>
  );
}

function entryWhen(e: Expense) {
  if (e.expense_date && e.end_date) return `${fmtRange(e.expense_date, e.end_date)} · ${nights(e.expense_date, e.end_date)} nights`;
  return fmtShortDate(e.expense_date);
}

function CategorySection({ c, counted, onEdit }: { c: CategorySummary; counted: Set<string>; onEdit: (e: Expense) => void }) {
  const meta = CATEGORY_MAP[c.category];
  const unitemized = c.totalCash - c.itemizedCash - c.extraCash;
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3.5">
        <CategoryIcon category={c.category} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{meta.label}</h3>
          {c.mode === "total" && c.itemizedCash + c.extraCash > 0 && (
            <p className="text-xs text-zinc-500">
              Trip total · {usd(c.itemizedCash + c.extraCash, true)} itemized{unitemized > 0 ? `, ${usd(unitemized, true)} not itemized` : ""}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="font-semibold tabular-nums">{usd(c.cash, true)}</div>
          {c.points > 0 && <div className="text-xs text-zinc-500 tabular-nums">{pts(c.points)} pts</div>}
        </div>
      </header>
      {c.overflow && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Icon name="alert" className="size-3.5 shrink-0" />
          Itemized entries add up to more than the trip total. Edit the total to fix this.
        </div>
      )}
      <ul className="divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
        {c.entries.map((e) => {
          const included = !counted.has(e.id);
          return (
            <li key={e.id}>
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50" onClick={() => onEdit(e)}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm font-medium ${included ? "text-zinc-500" : ""}`}>{e.description || meta.label}</span>
                    {e.entry_type !== "transaction" && (
                      <span className="shrink-0 rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--accent)] uppercase">
                        {e.entry_type === "category_total" ? "Trip total" : ENTRY_TYPE_MAP[e.entry_type].label}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {[entryWhen(e), e.points ? `${pts(e.points)} pts · ${e.program ?? "—"}` : null, included ? "included in trip total" : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className={`text-sm tabular-nums ${included ? "text-zinc-400 line-through" : "font-semibold"}`}>
                  {e.amount > 0 || !e.points ? usd(e.amount, true) : ""}
                </span>
                <Icon name="pencil" className="size-3.5 shrink-0 text-zinc-300 dark:text-zinc-600" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip";
