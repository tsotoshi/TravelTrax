"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Icon } from "@/components/Icon";
import { TripForm } from "@/components/TripForm";
import { BarList, CategoryIcon, EmptyState, ExportMenu, Modal, Stat } from "@/components/ui";
import { summarize, type CategorySummary } from "@/lib/calc";
import { fmtRange, fmtShortDate, nights, pts, usd } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CATEGORY_MAP, ENTRY_TYPE_MAP, type Expense } from "@/lib/types";

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { trips, expenses, ready, updateTrip, deleteTrip, addExpenses, updateExpense, deleteExpense } = useStore();
  const [editingTrip, setEditingTrip] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [adding, setAdding] = useState(false);

  const trip = trips.find((t) => t.id === id);
  const list = useMemo(() => expenses.filter((e) => e.trip_id === id), [expenses, id]);
  const s = useMemo(() => summarize(list), [list]);
  const programs = useMemo(() => [...new Set(expenses.map((e) => e.program).filter(Boolean) as string[])], [expenses]);

  if (!ready) return <div className="h-40 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />;
  if (!trip)
    return (
      <EmptyState icon="map" title="Trip not found">
        <Link href="/" className="text-[var(--accent)]">Back to dashboard</Link>
      </EmptyState>
    );

  const onDeleteExpense = async (e: Expense) => {
    if (confirm(`Delete "${e.description || CATEGORY_MAP[e.category].label}"?`)) await deleteExpense(e.id);
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div>
        <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <Icon name="back" className="size-3.5" /> All trips
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{trip.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
              {trip.destination && (
                <span className="flex items-center gap-1">
                  <Icon name="pin" className="size-3.5" /> {trip.destination}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Icon name="calendar" className="size-3.5" /> {fmtRange(trip.start_date, trip.end_date)}
                {nights(trip.start_date, trip.end_date) > 0 && ` · ${nights(trip.start_date, trip.end_date)} nights`}
              </span>
            </div>
            {trip.notes && <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-zinc-600 dark:text-zinc-400">{trip.notes}</p>}
          </div>
          <div className="flex gap-2">
            <Link href={`/import?trip=${trip.id}`} className="btn btn-secondary" title="Import expenses">
              <Icon name="upload" />
              <span className="hidden sm:inline">Import</span>
            </Link>
            <ExportMenu filename={slug(trip.name)} trips={[trip]} expenses={list} />
            <button className="btn btn-secondary" onClick={() => setEditingTrip(true)} title="Edit trip">
              <Icon name="pencil" />
              <span className="hidden sm:inline">Edit</span>
            </button>
            <button
              className="btn btn-secondary btn-danger"
              title="Delete trip"
              onClick={async () => {
                if (!confirm(`Delete "${trip.name}" and all ${list.length} expenses? This can't be undone.`)) return;
                await deleteTrip(trip.id);
                router.push("/");
              }}
            >
              <Icon name="trash" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat icon="wallet" label="Cash spent" value={usd(s.cash, true)} sub="USD" />
        <Stat icon="star" label="Points redeemed" value={pts(s.points)} sub={`${s.programs.length} program${s.programs.length === 1 ? "" : "s"}`} />
        <div className="col-span-2 lg:col-span-1">
          <Stat icon="calendar" label="Per day" value={usd(s.cash / Math.max(nights(trip.start_date, trip.end_date) + 1, 1))} sub={`${list.length} entries`} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {/* Fast entry: inline on desktop, button + sheet on mobile */}
          <section className="card hidden p-5 lg:block">
            <h2 className="mb-4 text-sm font-semibold">Add expense</h2>
            <ExpenseForm compact tripId={trip.id} programs={programs} onSubmit={(input) => addExpenses([input])} />
          </section>

          {s.categories.length === 0 ? (
            <EmptyState icon="wallet" title="No expenses yet">
              Add a transaction, a category total, or import a spreadsheet.
            </EmptyState>
          ) : (
            s.categories.map((c) => (
              <CategorySection key={c.category} c={c} counted={s.counted} onEdit={setEditing} onDelete={onDeleteExpense} />
            ))
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
            <BarList
              empty="No points redeemed"
              items={s.programs.map((p) => ({ key: p.program, label: p.program, value: p.points, display: pts(p.points) }))}
            />
          </section>
        </aside>
      </div>

      <button
        className="btn btn-primary fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 h-14 rounded-2xl px-5 shadow-lg lg:hidden"
        onClick={() => setAdding(true)}
      >
        <Icon name="plus" className="size-5" /> Add expense
      </button>

      {adding && (
        <Modal title="Add expense" onClose={() => setAdding(false)}>
          <ExpenseForm tripId={trip.id} programs={programs} onSubmit={(input) => addExpenses([input])} onCancel={() => setAdding(false)} />
          <p className="mt-3 text-center text-xs text-zinc-500">The form stays open so you can add several in a row.</p>
        </Modal>
      )}
      {editing && (
        <Modal title="Edit expense" onClose={() => setEditing(null)}>
          <ExpenseForm
            tripId={trip.id}
            expense={editing}
            programs={programs}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              await updateExpense(editing.id, input);
              setEditing(null);
            }}
          />
        </Modal>
      )}
      {editingTrip && (
        <Modal title="Edit trip" onClose={() => setEditingTrip(false)}>
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

function CategorySection({
  c,
  counted,
  onEdit,
  onDelete,
}: {
  c: CategorySummary;
  counted: Set<string>;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  const meta = CATEGORY_MAP[c.category];
  const unitemized = c.totalCash - c.itemizedCash - c.extraCash;
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <CategoryIcon category={c.category} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{meta.label}</h3>
          <p className="text-xs text-zinc-500">
            {c.mode === "total"
              ? c.itemizedCash + c.extraCash > 0
                ? `Category total · ${usd(c.itemizedCash + c.extraCash, true)} itemized${unitemized > 0 ? `, ${usd(unitemized, true)} unitemized` : ""}`
                : "Category total"
              : c.extraCash > 0
                ? `${usd(c.itemizedCash, true)} itemized + ${usd(c.extraCash, true)} unitemized`
                : `${c.entries.length} transaction${c.entries.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="text-right">
          <div className="font-semibold tabular-nums">{usd(c.cash, true)}</div>
          {c.points > 0 && <div className="text-xs text-zinc-500 tabular-nums">{pts(c.points)} pts</div>}
        </div>
      </header>
      {c.overflow && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Icon name="alert" className="size-3.5 shrink-0" />
          Itemized entries exceed the category total. Raise the total, or change the extra spending to “Unitemized extra” and remove the total.
        </div>
      )}
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {c.entries.map((e) => {
          const included = !counted.has(e.id);
          return (
            <li key={e.id} className="group flex items-center gap-3 px-4 py-2.5">
              <button className="min-w-0 flex-1 text-left" onClick={() => onEdit(e)}>
                <div className="flex items-center gap-2">
                  <span className={`truncate text-sm ${included ? "text-zinc-500" : ""}`}>{e.description || (e.entry_type === "category_total" ? `All ${meta.label.toLowerCase()}` : meta.label)}</span>
                  {e.entry_type !== "transaction" && (
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                        e.entry_type === "category_total"
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {ENTRY_TYPE_MAP[e.entry_type].label}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {[fmtShortDate(e.expense_date), e.points ? `${pts(e.points)} pts · ${e.program ?? "—"}` : null, included ? "included in category total" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </button>
              <span className={`text-sm tabular-nums ${included ? "text-zinc-400 line-through decoration-zinc-300 dark:decoration-zinc-600" : "font-medium"}`}>
                {usd(e.amount, true)}
              </span>
              <div className="flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                <button className="btn btn-ghost size-8 px-0" onClick={() => onEdit(e)} aria-label="Edit">
                  <Icon name="pencil" className="size-3.5" />
                </button>
                <button className="btn btn-danger size-8 px-0" onClick={() => onDelete(e)} aria-label="Delete">
                  <Icon name="trash" className="size-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip";
