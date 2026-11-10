"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Calendar where the first tap picks the start and the second tap picks the end.
 * In `single` mode one tap picks the date.
 */
export function DateRangePicker({
  start,
  end,
  onChange,
  single,
  defaultMonth,
}: {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  single?: boolean;
  /** YYYY-MM-DD whose month to show when nothing is picked (e.g. the trip start). */
  defaultMonth?: string;
}) {
  const initial = start ? fromIso(start) : defaultMonth ? fromIso(defaultMonth) : new Date();
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  // Jump to a start date picked outside the calendar (e.g. "Use trip dates") if it isn't visible.
  useEffect(() => {
    if (!start) return;
    const d = fromIso(start);
    setView((v) => {
      const months = (d.getFullYear() - v.getFullYear()) * 12 + d.getMonth() - v.getMonth();
      return months === 0 || months === 1 ? v : new Date(d.getFullYear(), d.getMonth(), 1);
    });
  }, [start]);
  const [hover, setHover] = useState<string | null>(null);
  const choosingEnd = !single && !!start && !end;

  function pick(d: string) {
    if (single) return onChange(d, null);
    if (!start || end || d < start) return onChange(d, null);
    onChange(start, d);
  }

  const shift = (n: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));
  const months = [view, new Date(view.getFullYear(), view.getMonth() + 1, 1)];
  const rangeEnd = end ?? (choosingEnd && hover && hover >= start! ? hover : null);

  return (
    <div className="select-none" onMouseLeave={() => setHover(null)}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="btn btn-ghost size-9 rounded-full px-0" onClick={() => shift(-1)} aria-label="Previous month">
          <Icon name="back" />
        </button>
        <span className="text-xs font-medium text-zinc-500">
          {single ? "Tap a date" : choosingEnd ? "Now tap the end date" : start && end ? "Tap a new start date to change" : "Tap the start date"}
        </span>
        <button type="button" className="btn btn-ghost size-9 rounded-full px-0" onClick={() => shift(1)} aria-label="Next month">
          <Icon name="back" className="size-4 rotate-180" />
        </button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {months.map((m, mi) => {
          const first = m.getDay();
          const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
          const cells: (string | null)[] = [
            ...Array(first).fill(null),
            ...Array.from({ length: days }, (_, i) => iso(new Date(m.getFullYear(), m.getMonth(), i + 1))),
          ];
          return (
            <div key={mi} className={mi === 1 ? "hidden sm:block" : ""}>
              <div className="mb-2 text-center text-sm font-semibold">{monthLabel.format(m)}</div>
              <div className="grid grid-cols-7 text-center text-[11px] font-medium text-zinc-400">
                {WEEK.map((w, i) => (
                  <div key={i} className="py-1">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const isStart = d === start;
                  const isEnd = d === rangeEnd;
                  const inRange = !!start && !!rangeEnd && d > start && d < rangeEnd;
                  const edge = isStart || isEnd;
                  const today = d === iso(new Date());
                  return (
                    <div
                      key={i}
                      className={`relative h-10 ${inRange ? "bg-[var(--accent-soft)]" : ""} ${
                        isStart && rangeEnd && rangeEnd !== start ? "rounded-l-full bg-[var(--accent-soft)]" : ""
                      } ${isEnd && start && rangeEnd !== start ? "rounded-r-full bg-[var(--accent-soft)]" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => pick(d)}
                        onMouseEnter={() => setHover(d)}
                        className={`absolute inset-0.5 rounded-full text-sm tabular-nums transition ${
                          edge
                            ? "bg-[var(--accent)] font-semibold text-white dark:text-zinc-950"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        } ${today && !edge ? "font-semibold text-[var(--accent)]" : ""}`}
                        aria-pressed={edge}
                        aria-label={d}
                      >
                        {Number(d.slice(8))}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
