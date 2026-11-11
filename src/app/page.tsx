"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { TripForm } from "@/components/TripForm";
import { BarList, CategoryBreakdown, CategoryLegend, CategoryStrip, EmptyState, ExportMenu, MeasureSwitch, Modal, YearChart, type Measure } from "@/components/ui";
import { EMPTY_SUMMARY, summarizeByTrip } from "@/lib/calc";
import { compact, fmtRange, nights, pts, usd } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/types";

export default function Dashboard() {
  const { trips, expenses, ready, addTrip, loadSamples } = useStore();
  const router = useRouter();
  const [year, setYear] = useState("all");
  // One switch decides whether every chart on the dashboard shows cash or points.
  const [measure, setMeasure] = useState<Measure>("cash");
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
    const catPoints = new Map<string, number>();
    const progs = new Map<string, number>();
    let cash = 0;
    let points = 0;
    for (const t of shown) {
      const s = sums.get(t.id) ?? EMPTY_SUMMARY;
      cash += s.cash;
      points += s.points;
      s.categories.forEach((c) => {
        cats.set(c.category, (cats.get(c.category) ?? 0) + c.cash);
        catPoints.set(c.category, (catPoints.get(c.category) ?? 0) + c.points);
      });
      s.programs.forEach((p) => progs.set(p.program, (progs.get(p.program) ?? 0) + p.points));
    }
    return { cash, points, cats, catPoints, progs };
  }, [shown, sums]);

  if (!ready) return <Skeleton />;

  const shownIds = new Set(shown.map((t) => t.id));

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em]">Your travels</h1>
          <p className="mt-0.5 text-[13px] text-muted">{year === "all" ? "All trips" : `Trips in ${year}`}</p>
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
          <p>Create your first trip, or load sample data to explore.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" /> New trip
            </button>
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
          {/* Summary: Cash and Points side by side at equal size; trips and nights below. */}
          <section className="card">
            <div className="grid grid-cols-2">
              {[
                ["Cash spent", usd(Math.round(totals.cash))],
                ["Points used", compact(totals.points)],
              ].map(([l, v], i) => (
                <div key={l} className={`min-w-0 px-4 py-4 sm:px-6 sm:py-5 ${i > 0 ? "border-l border-line" : ""}`}>
                  <div className="eyebrow">{year === "all" ? l : `${l} in ${year}`}</div>
                  <div className="mt-2 truncate text-[28px] leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-[34px]">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-5 border-t border-line px-4 py-2 text-[13px] text-muted tabular-nums sm:px-6">
              <span>
                <b className="font-semibold text-fg">{shown.length}</b> {shown.length === 1 ? "trip" : "trips"}
              </span>
              <span>
                <b className="font-semibold text-fg">{shown.reduce((s, t) => s + nights(t.start_date, t.end_date), 0)}</b> nights
              </span>
            </div>
          </section>

          <section>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight">Spending</h2>
            <MeasureSwitch value={measure} onChange={setMeasure} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <section className="card flex flex-col p-4 md:col-span-2 lg:col-span-1">
              <h2 className="card-title mb-2">{measure === "cash" ? "Cash spent by year" : "Points used by year"}</h2>
              <YearChart data={byYear} selected={year} onSelect={setYear} measure={measure} />
            </section>
            <CategoryBreakdown
              mode={measure}
              parts={CATEGORIES.map((c) => ({ category: c.key, cash: totals.cats.get(c.key) ?? 0, points: totals.catPoints.get(c.key) ?? 0 }))}
            />
            <section className="card p-4">
              <h2 className="card-title mb-2.5">Points by program</h2>
              <BarList
                empty="No points redeemed"
                items={[...totals.progs]
                  .sort((a, b) => b[1] - a[1])
                  .map(([p, n]) => ({ key: p, label: p, value: n, display: pts(n), color: "var(--accent-ink)" }))}
              />
            </section>
          </div>
          </section>

          <section>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="flex shrink-0 items-center gap-2.5">
                <h2 className="text-[15px] font-semibold tracking-tight">Trips</h2>
                <MeasureSwitch value={measure} onChange={setMeasure} />
              </div>
              {/* Looks like the Cash/Points switch (12px). The real select sits on top, invisible, at 16px so iPhones don't zoom on tap. */}
              <label className="relative inline-flex shrink-0 items-center gap-1 rounded-lg border border-edge bg-subtle px-2.5 py-1 text-xs font-medium text-fg transition-colors hover:border-edge-strong has-[:focus-visible]:border-accent has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-accent/20">
                {year === "all" ? "All years" : year}
                <Icon name="chevron" className="size-3.5 text-muted" />
                <select
                  className="absolute inset-0 cursor-pointer appearance-none opacity-0 text-base"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  aria-label="Show trips from"
                >
                  {["all", ...years].map((y) => (
                    <option key={y} value={y}>
                      {y === "all" ? "All years" : y}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="card overflow-hidden">
              <div className="eyebrow grid grid-cols-[minmax(0,1fr)_4.5rem_4.75rem] gap-x-4 border-b border-line bg-subtle/40 px-4 py-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_7rem_7rem_1rem] sm:gap-x-6 sm:px-5">
                <span>Trip</span>
                <span className="hidden sm:block">Breakdown</span>
                <span className="text-right">Cash</span>
                <span className="text-right">Points</span>
                <span className="hidden sm:block" />
              </div>
              <ul className="divide-y divide-line">
                {shown.map((t) => {
                  const s = sums.get(t.id) ?? EMPTY_SUMMARY;
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/trips/${t.id}`}
                        className="group grid grid-cols-[minmax(0,1fr)_4.5rem_4.75rem] items-center gap-x-4 gap-y-2 px-4 py-3 transition-[background-color] hover:bg-subtle/60 focus-visible:bg-subtle focus-visible:outline-none sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_7rem_7rem_1rem] sm:gap-x-6 sm:px-5"
                      >
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-medium">{t.name}</h3>
                          <p className="mt-0.5 hidden min-w-0 items-center sm:flex gap-1.5 text-xs text-muted">
                            <Icon name="pin" className="size-3 shrink-0" />
                            <span className="truncate">{t.destination || "—"}</span>
                            <span className="text-faint">·</span>
                            <span className="shrink-0 tabular-nums">{fmtRange(t.start_date, t.end_date)}</span>
                          </p>
                        </div>
                        <div className="col-span-3 row-start-3 min-w-0 sm:col-span-1 sm:row-start-auto">
                          <CategoryStrip parts={s.categories} measure={measure} />
                          <CategoryLegend parts={s.categories} measure={measure} />
                        </div>
                        <span className="text-right text-sm font-semibold tabular-nums">{usd(Math.round(s.cash))}</span>
                        <span className="text-right text-sm font-semibold tabular-nums">
                          {s.points ? (
                            pts(s.points)
                          ) : (
                            <span className="font-normal text-faint">—</span>
                          )}
                        </span>
                        {/* On phones the destination and dates get their own full-width line. */}
                        <p className="col-span-3 -mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted sm:hidden">
                          <Icon name="pin" className="size-3 shrink-0" />
                          <span className="truncate">{t.destination || "—"}</span>
                          <span className="text-faint">·</span>
                          <span className="shrink-0 tabular-nums">{fmtRange(t.start_date, t.end_date)}</span>
                        </p>
                        <Icon name="back" className="hidden size-3.5 rotate-180 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-muted sm:block" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </>
      )}

      {creating && (
        <Modal title="New trip" onClose={() => setCreating(false)} wide>
          <TripForm
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              const t = await addTrip(input);
              router.push(`/trips/${t.id}?add=1`);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-8 w-48 rounded-md bg-subtle" />
      <div className="h-20 rounded-xl bg-subtle" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-44 rounded-xl bg-subtle" />
        ))}
      </div>
    </div>
  );
}
