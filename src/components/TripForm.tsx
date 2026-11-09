"use client";

import { useState } from "react";
import { fmtRange, nights } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Trip, TripInput } from "@/lib/types";
import { DateRangePicker } from "./DateRangePicker";
import { PlaceInput } from "./PlaceInput";

export function TripForm({
  trip,
  onSubmit,
  onCancel,
}: {
  trip?: Trip;
  onSubmit: (input: TripInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { trips } = useStore();
  const [name, setName] = useState(trip?.name ?? "");
  const [destination, setDestination] = useState(trip?.destination ?? "");
  const [start, setStart] = useState<string | null>(trip?.start_date ?? null);
  const [end, setEnd] = useState<string | null>(trip?.end_date ?? null);
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [showNotes, setShowNotes] = useState(!!trip?.notes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const recent = [...new Set(trips.map((t) => t.destination).filter(Boolean))];

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!start) return setErr("Pick your trip dates.");
        setBusy(true);
        setErr(null);
        try {
          await onSubmit({
            name: name.trim() || destination.split(",")[0].trim() || "Trip",
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
        <label className="label" htmlFor="t-dest">Where are you going?</label>
        <PlaceInput id="t-dest" value={destination} onChange={setDestination} recent={recent} placeholder="Search a city or country" />
      </div>
      <div>
        <label className="label" htmlFor="t-name">Trip name</label>
        <input
          id="t-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={destination ? `${destination.split(",")[0]} trip` : "Summer in Italy"}
        />
      </div>
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="label mb-0">When?</span>
          <span className="text-sm font-medium">
            {start ? (end ? `${fmtRange(start, end)} · ${nights(start, end)} nights` : `${fmtRange(start, start)} → pick end`) : ""}
          </span>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-900/5 dark:bg-zinc-950 dark:ring-white/10">
          <DateRangePicker
            start={start}
            end={end}
            onChange={(s, e) => {
              setStart(s);
              setEnd(e);
            }}
          />
        </div>
      </div>
      {showNotes ? (
        <div>
          <label className="label" htmlFor="t-notes">Notes</label>
          <textarea id="t-notes" className="input h-auto min-h-20 py-3" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      ) : (
        <button type="button" className="text-sm font-medium text-[var(--accent)]" onClick={() => setShowNotes(true)}>
          + Add notes
        </button>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" className="btn btn-secondary flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary flex-[2]" disabled={busy || !start || !destination.trim()}>
          {trip ? "Save changes" : "Create trip"}
        </button>
      </div>
    </form>
  );
}
