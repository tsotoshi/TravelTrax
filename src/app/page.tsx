"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { TripForm } from "@/components/TripForm";
import { BarList, CategoryIcon, CategoryStrip, EmptyState, ExportMenu, Modal, Stat, YearChart } from "@/components/ui";
import { EMPTY_SUMMARY, summarizeByTrip } from "@/lib/calc";
import { fmtRange, nights, pts, usd } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/types";

export default function Dashboard() {
  const { trips, expenses, ready, addTrip, loadSamples } = useStore();
  const router = useRouter();
  const [year, setYear] = useState("all");
  const [creating, setCreating] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);

  const sums = useMemo(() => summarizeByTrip(expenses), [expenses]);
  const sorted = useMemo(() => [...trips].sort((a, b) => b.start_date.localeCompare(a.start_date)), [trips]);
  const years = useMemo(() => [...new Set(sorted.map((t) => t.start_date.slice(0, 4)))], [sorted]);
  const shown = year === "all" ? sorted : sorted.filter((t) => t.start_date.startsWith(year));

  const byYear = useMemo(
    () =>
      [...years].reverse().map((y) => {
        const ts = sorted.filter((t) => t.start_date.startsWith(y));
        return {
          year: y,
          cash: ts.reduce((s, t) => s + (sums.get(t.id)?.cash ?? 0), 0),
          points: ts.reduce((s, t) => s + (sums.get(t.id)?.points ?? 0), 0),
        };
      }),
    [years, sorted, sums],
  );

  const totals = useMemo(() => {
    const cats = new Map<string, number>();
    const progs = new Map<string, number>();
    let cash = 0;
    let points = 0;
    for (const t of shown) {
      const s = sums.get(t.id) ?? EMPTY_SUMMARY;
      cash += s.cash;
      points += s.points;
      s.categories.forEach((c) => cats.set(c.category, (cats.get(c.category) ?? 0) + c.cash));
      s.programs.forEach((p) => progs.set(p.program, (progs.get(p.program) ?? 0) + p.points));
    }
    return { cash, points, cats, progs };
  }, [shown, sums]);

  if (!ready) return <Skeleton />;

  const shownIds = new Set(shown.map((t) => t.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500">{year === "all" ? "All trips" : `Trips in ${year}`}</p>
        </div>
        <div className="flex gap-2">
          {trips.length > 0 && (
            <ExportMenu
              filename={year === "all" ? "traveltrax-all-trips" : `traveltrax-${year}`}
              trips={shown}
              expenses={expenses.filter((e) => shownIds.has(e.trip_id))}
            />
          )}
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> New trip
          </button>
        </div>
      </div>

      {trips.length === 0 ? (
        <EmptyState icon="plane" title="No trips yet">
          <p>Create your first trip, import a spreadsheet, or load sample data to explore.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" /> New trip
            </button>
            <Link href="/import" className="btn btn-secondary">
              <Icon name="upload" /> Import
            </Link>
            <button
              className="btn btn-secondary"
              disabled={loadingSamples}
              onClick={async () => {
                setLoadingSamples(true);
                await loadSamples().finally(() => setLoadingSamples(false));
              }}
            >
              Load sample trips
            </button>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <Stat icon="wallet" label="Cash spent" value={usd(totals.cash)} sub="USD" />
            <Stat icon="star" label="Points redeemed" value={pts(totals.points)} sub={`${totals.progs.size} program${totals.progs.size === 1 ? "" : "s"}`} />
            <div className="col-span-2 lg:col-span-1">
              <Stat
                icon="map"
                label="Trips"
                value={String(shown.length)}
                sub={`${shown.reduce((s, t) => s + nights(t.start_date, t.end_date), 0)} nights away`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="card flex flex-col p-5">
              <h2 className="mb-4 text-sm font-semibold">Spending by year</h2>
              <YearChart data={byYear} selected={year} onSelect={setYear} />
            </section>
            <section className="card p-5">
              <h2 className="mb-4 text-sm font-semibold">By category</h2>
              <BarList
                empty="No spending yet"
                items={CATEGORIES.filter((c) => totals.cats.get(c.key)).map((c) => ({
                  key: c.key,
                  label: (
                    <span className="flex items-center gap-2">
                      <CategoryIcon category={c.key} size="sm" /> {c.label}
                    </span>
                  ),
                  value: totals.cats.get(c.key) ?? 0,
                  display: usd(totals.cats.get(c.key) ?? 0),
                  color: c.color,
                }))}
              />
            </section>
            <section className="card p-5">
              <h2 className="mb-4 text-sm font-semibold">Points by program</h2>
              <BarList
                empty="No points redeemed"
                items={[...totals.progs]
                  .sort((a, b) => b[1] - a[1])
                  .map(([p, n]) => ({ key: p, label: p, value: n, display: pts(n) }))}
              />
            </section>
          </div>

          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-lg font-semibold">Trips</h2>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
                {["all", ...years].map((y) => (
                  <button key={y} className={`chip ${year === y ? "chip-on" : ""}`} onClick={() => setYear(y)}>
                    {y === "all" ? "All years" : y}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((t) => {
                const s = sums.get(t.id) ?? EMPTY_SUMMARY;
                return (
                  <Link key={t.id} href={`/trips/${t.id}`} className="card group block p-4 transition hover:shadow-md hover:shadow-zinc-200/60 dark:hover:border-zinc-700 dark:hover:shadow-none">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold group-hover:text-[var(--accent)]">{t.name}</h3>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-zinc-500">
                          <Icon name="pin" className="size-3.5 shrink-0" />
                          {t.destination || "—"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {fmtRange(t.start_date, t.end_date)}
                      </span>
                    </div>
                    <div className="mt-4 mb-3 flex items-end justify-between">
                      <div>
                        <div className="text-xl font-semibold tabular-nums">{usd(s.cash)}</div>
                        <div className="text-xs text-zinc-500">cash</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium tabular-nums">{s.points ? pts(s.points) : "—"}</div>
                        <div className="text-xs text-zinc-500">points</div>
                      </div>
                    </div>
                    <CategoryStrip parts={s.categories} />
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}

      {creating && (
        <Modal title="New trip" onClose={() => setCreating(false)}>
          <TripForm
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              const t = await addTrip(input);
              router.push(`/trips/${t.id}`);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="h-56 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
