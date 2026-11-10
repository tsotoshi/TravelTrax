"use client";

import { useState } from "react";
import { fmtRange } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Trip } from "@/lib/types";
import { Icon } from "./Icon";

/**
 * Error shown when an expense's date falls outside its trip, with a shortcut that
 * widens the trip just enough to include it (e.g. a red-eye the night before).
 */
export function TripDateError({ trip, start, end }: { trip: Trip; start: string; end?: string | null }) {
  const { updateTrip } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const last = end ?? start;
  const newStart = start < trip.start_date ? start : trip.start_date;
  const newEnd = last > trip.end_date ? last : trip.end_date;

  return (
    <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 text-[13px] text-red-700 dark:text-red-300">
      <p className="flex items-start gap-2">
        <Icon name="alert" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          This date is outside your trip ({fmtRange(trip.start_date, trip.end_date)}). Pick a date within the trip, or extend the trip.
        </span>
      </p>
      <button
        type="button"
        className="btn btn-secondary mt-2 h-8 text-[13px] sm:h-8"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await updateTrip(trip.id, {
              name: trip.name,
              destination: trip.destination,
              start_date: newStart,
              end_date: newEnd,
              notes: trip.notes,
            });
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Could not update the trip.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Extend trip to {fmtRange(newStart, newEnd)}
      </button>
      {err && <p className="mt-1.5">{err}</p>}
    </div>
  );
}
