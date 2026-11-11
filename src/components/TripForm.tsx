"use client";

import { useState } from "react";
import { fmtRange, nights, outsideTrip } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Trip, TripInput } from "@/lib/types";
import { DateRangePicker } from "./DateRangePicker";
import { PlaceInput } from "./PlaceInput";

const city = (destination: string) => destination.split(",")[0].trim();

export function TripForm({
  trip,
  onSubmit,
  onCancel,
}: {
  trip?: Trip;
  onSubmit: (input: TripInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { trips, expenses } = useStore();
  const [name, setName] = useState(trip?.name ?? "");
  // A new trip's name follows the destination until the user types their own.
  const [nameTouched, setNameTouched] = useState(!!trip);
  const [destination, setDestination] = useState(trip?.destination ?? "");
  const [start, setStart] = useState<string | null>(trip?.start_date ?? null);
  const [end, setEnd] = useState<string | null>(trip?.end_date ?? null);
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [showNotes, setShowNotes] = useState(!!trip?.notes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const recent = [...new Set(trips.map((t) => t.destination).filter(Boolean))];

  const missing = [!name.trim() && "a trip name", !destination.trim() && "a destination", !start && "your dates"].filter(Boolean) as string[];
  // Editing dates must not leave existing expenses outside the trip.
  const stranded =
    trip && start
      ? expenses.filter((e) => e.trip_id === trip.id && outsideTrip({ start_date: start, end_date: end ?? start }, e.expense_date, e.end_date))
      : [];

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (missing.length || !start || stranded.length) return;
        setBusy(true);
        setErr(null);
        try {
          await onSubmit({
            name: name.trim(),
            destination: destination.trim(),
            start_date: start,
            end_date: end ?? start,
            notes: notes.trim() || null,
          });
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Could not save trip.");
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="t-dest">Destination</label>
        <PlaceInput
          id="t-dest"
          value={destination}
          onChange={(v) => {
            setDestination(v);
            if (!nameTouched) setName(city(v));
          }}
          recent={recent}
          placeholder="Search a city or country"
        />
      </div>
      <div>
        <label className="label" htmlFor="t-name">Trip name</label>
        <input
          id="t-name"
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameTouched(e.target.value.trim() !== "");
          }}
          placeholder="e.g. Summer in Italy"
        />
      </div>
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="label mb-0">Dates</span>
          <span className="text-[13px] font-medium tabular-nums">
            {start ? (end ? `${fmtRange(start, end)} · ${nights(start, end)} nights` : `${fmtRange(start, start)} → pick end`) : ""}
          </span>
        </div>
        <div className="rounded-xl border border-edge p-3">
          <DateRangePicker
            start={start}
            end={end}
            onChange={(s, e) => {
              setStart(s);
              setEnd(e);
            }}
          />
        </div>
        {stranded.length > 0 && (
          <p role="alert" className="mt-2 text-[13px] text-red-600 dark:text-red-400">
            {stranded.length === 1 ? "1 expense is" : `${stranded.length} expenses are`} dated outside these dates (
            {stranded
              .slice(0, 3)
              .map((x) => x.description || "Untitled")
              .join(", ")}
            {stranded.length > 3 ? ", …" : ""}). Pick dates that include {stranded.length === 1 ? "it" : "them"}, or change those expenses first.
          </p>
        )}
      </div>
      {showNotes ? (
        <div>
          <label className="label" htmlFor="t-notes">Notes</label>
          <textarea id="t-notes" className="input h-auto min-h-20 py-2.5 sm:h-auto" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      ) : (
        <button type="button" className="text-[13px] font-medium text-accent-ink hover:underline underline-offset-2" onClick={() => setShowNotes(true)}>
          + Add notes
        </button>
      )}
      {err && <p className="text-[13px] text-red-600 dark:text-red-400">{err}</p>}
      {/* Pinned to the bottom of the sheet so the button is always in view. */}
      <div className="sticky -bottom-[max(1.25rem,env(safe-area-inset-bottom))] -mx-5 -mb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-edge bg-surface px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
        {missing.length > 0 && <p className="mb-2 text-center text-xs text-muted">Add {listOf(missing)} to continue.</p>}
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary flex-1" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary flex-[2]" disabled={busy || missing.length > 0 || stranded.length > 0}>
            {trip ? "Save changes" : "Create trip"}
          </button>
        </div>
      </div>
    </form>
  );
}

function listOf(xs: string[]) {
  return xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}
