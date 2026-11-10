"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AddExpenseWizard } from "@/components/AddExpenseWizard";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Icon } from "@/components/Icon";
import { TripForm } from "@/components/TripForm";
import { BarList, CategoryIcon, EmptyState, ExportMenu, Modal, StatBox } from "@/components/ui";
import { dollars, extrasNote, summarize, type CategorySummary } from "@/lib/calc";
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

  if (!ready) return <div className="h-40 animate-pulse rounded-xl bg-subtle" />;
  if (!trip)
    return (
      <EmptyState icon="map" title="Trip not found">
        <Link href="/" className="font-medium text-accent-ink hover:underline">Back to dashboard</Link>
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
      {/* Header */}
      <header>
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link href="/" className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[13px] text-muted transition-colors hover:text-fg">
            <Icon name="back" className="size-3.5" /> All trips
          </Link>
          <div className="flex shrink-0 gap-1.5">
            <Link href={`/import?trip=${trip.id}`} className="btn btn-secondary size-9 px-0 sm:size-8" title="Import expenses" aria-label="Import expenses">
              <Icon name="upload" />
            </Link>
            <ExportMenu filename={slug(trip.name)} trips={[trip]} expenses={list} buttonClass="btn btn-secondary size-9 px-0 sm:size-8" iconOnly />
            <button className="btn btn-secondary size-9 px-0 sm:size-8" onClick={() => setEditingTrip(true)} title="Edit trip" aria-label="Edit trip">
              <Icon name="pencil" />
            </button>
            <button className="btn btn-primary hidden h-8 lg:flex" onClick={() => setWizard({})}>
              <Icon name="plus" /> Add expense
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em] sm:text-[30px]">{trip.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              {trip.destination && (
                <span className="flex items-center gap-1.5">
                  <Icon name="pin" className="size-3.5 text-faint" /> {trip.destination}
                </span>
              )}
              <span className="flex items-center gap-1.5 tabular-nums">
                <Icon name="calendar" className="size-3.5 text-faint" /> {fmtRange(trip.start_date, trip.end_date)}
                {n > 0 && <span className="text-faint">· {n} nights</span>}
              </span>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 border-t border-line pt-3.5 sm:border-t-0 sm:pt-0">
            <div className="pr-5 sm:pr-6 sm:text-right">
              <StatBox label="Spent" value={usdShort(s.cash)} size="lg" />
            </div>
            <div className="border-l border-line pl-5 sm:pl-6 sm:text-right">
              <StatBox label="Points" value={compact(s.points)} size="lg" />
            </div>
          </div>
        </div>
        {trip.notes && <p className="mt-3 max-w-2xl border-l-2 border-edge-strong pl-3 text-[13px] whitespace-pre-line text-muted">{trip.notes}</p>}
      </header>

      {missing.length > 0 && (
        <section>
          <h2 className="eyebrow mb-2">Next up</h2>
          <div className="grid grid-cols-2 gap-2">
            {missing.map((c) => (
              <button key={c} className="tile border-dashed" onClick={() => setWizard({ category: c })}>
                <CategoryIcon category={c} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Add {c === "flights" ? "flights" : "hotel"}</span>
                  <span className="block truncate text-xs text-muted">{c === "flights" ? "Depart & return" : "Your stay"}</span>
                </span>
                <Icon name="plus" className="ml-auto hidden size-4 shrink-0 text-faint sm:block" />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-2.5">
          {s.categories.length === 0 ? (
            <EmptyState icon="wallet" title="No expenses yet">
              Tap <b className="font-medium text-fg">Add expense</b> and we&apos;ll walk you through it.
            </EmptyState>
          ) : (
            s.categories.map((c) => <CategorySection key={c.category} c={c} counted={s.counted} onEdit={setEditing} />)
          )}
        </div>

        <aside className="space-y-2.5">
          <section className="card p-4">
            <h2 className="card-title mb-2.5">By category</h2>
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
                display: usd(Math.round(c.cash)),
                sub: s.cash ? `${Math.round((c.cash / s.cash) * 100)}%` : undefined,
                color: CATEGORY_MAP[c.category].color,
              }))}
            />
          </section>
          <section className="card p-4">
            <h2 className="card-title mb-2.5">Points by program</h2>
            <BarList empty="No points redeemed" items={s.programs.map((p) => ({ key: p.program, label: p.program, value: p.points, display: pts(p.points), color: "var(--accent-ink)" }))} />
          </section>
          <button
            className="btn btn-danger w-full text-[13px]"
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
        className="btn btn-primary fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 h-11 rounded-full pr-4 pl-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_8px_24px_-6px_rgb(0_0_0/0.5)] lg:hidden"
        onClick={() => setWizard({})}
      >
        <Icon name="plus" className="size-4" /> Add expense
      </button>

      {wizard && (
        <Modal title="Add expense" onClose={() => setWizard(null)} wide>
          <AddExpenseWizard
            trip={trip}
            tripExpenses={list}
            programs={programs}
            initialCategory={wizard.category}
            onSave={addExpenses}
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

function entryWhen(e: Expense) {
  if (e.expense_date && e.end_date) return `${fmtRange(e.expense_date, e.end_date)} · ${nights(e.expense_date, e.end_date)} nights`;
  return fmtShortDate(e.expense_date);
}

/** Shared column template so section totals line up with the rows below them. */
const COLS = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_0.875rem]";

function CategorySection({ c, counted, onEdit }: { c: CategorySummary; counted: Set<string>; onEdit: (e: Expense) => void }) {
  const meta = CATEGORY_MAP[c.category];
  const unitemized = c.totalCash - c.itemizedCash - c.extraCash;
  const subline = [
    c.mode === "total" && c.itemizedCash + c.extraCash > 0
      ? `Trip total · ${usd(c.itemizedCash + c.extraCash, true)} itemized${unitemized > 0 ? `, ${usd(unitemized, true)} not itemized` : ""}`
      : null,
    extrasNote(c.cash, c.fees, c.baggage, true),
  ].filter(Boolean);
  return (
    <section className="card overflow-hidden">
      <header className={`${COLS} border-b border-line bg-subtle/40 px-4 py-2.5`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <CategoryIcon category={c.category} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight">{meta.label}</h3>
            {subline.length > 0 && <p className="truncate text-xs text-muted">{subline.join(" · ")}</p>}
          </div>
        </div>
        <div className="flex flex-col items-end sm:contents">
          <span className="text-sm font-semibold tracking-tight tabular-nums sm:text-right">{usd(Math.round(c.cash))}</span>
          <span className={`text-xs tabular-nums sm:text-right sm:text-sm sm:font-semibold sm:tracking-tight ${c.points ? "text-muted sm:text-fg" : "hidden text-faint sm:block"}`}>
            {c.points ? (
              <>
                {pts(c.points)}
                <span className="text-xs font-normal text-faint"> pts</span>
              </>
            ) : (
              "—"
            )}
          </span>
        </div>
      </header>
      {c.overflow && (
        <div className="flex items-center gap-2 border-b border-amber-500/15 bg-amber-500/[0.06] px-4 py-2 text-xs text-amber-800 dark:text-amber-200/90">
          <Icon name="alert" className="size-3.5 shrink-0" />
          Itemized entries add up to more than the trip total. Edit the total to fix this.
        </div>
      )}
      <ul className="divide-y divide-line">
        {c.entries.map((e) => {
          const included = !counted.has(e.id);
          const showCash = dollars(e) > 0 || !e.points;
          const amt = included ? "text-faint line-through" : "font-medium";
          return (
            <li key={e.id}>
              <button
                className={`${COLS} group w-full px-4 py-2 text-left transition-[background-color] hover:bg-subtle/60 focus-visible:bg-subtle focus-visible:outline-none`}
                onClick={() => onEdit(e)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-[13px] font-medium ${included ? "text-muted" : ""}`}>{e.description || meta.label}</span>
                    {e.entry_type !== "transaction" && (
                      <span className="badge border border-edge bg-subtle text-muted">
                        {e.entry_type === "category_total" ? "Trip total" : ENTRY_TYPE_MAP[e.entry_type].label}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {[
                      entryWhen(e),
                      e.points ? (e.program ?? "—") : null,
                      e.fees ? `${usd(e.fees)} fees` : null,
                      e.baggage ? `${usd(e.baggage)} bags` : null,
                      included ? "included in trip total" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="flex flex-col items-end text-[13px] tabular-nums sm:contents">
                  <span className={`sm:text-right ${amt} ${showCash ? "" : "hidden sm:block"}`}>{showCash ? usd(dollars(e), true) : ""}</span>
                  <span className={`sm:text-right ${amt} ${e.points > 0 ? "" : "hidden sm:block"}`}>
                    {e.points > 0 && (
                      <>
                        {pts(e.points)}
                        <span className="font-normal text-faint"> pts</span>
                      </>
                    )}
                  </span>
                </div>
                <Icon name="pencil" className="hidden size-3.5 text-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip";
