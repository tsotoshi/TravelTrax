"use client";

import { useState } from "react";
import { today } from "@/lib/format";
import type { Trip, TripInput } from "@/lib/types";

export function TripForm({
  trip,
  onSubmit,
  onCancel,
}: {
  trip?: Trip;
  onSubmit: (input: TripInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState<TripInput>({
    name: trip?.name ?? "",
    destination: trip?.destination ?? "",
    start_date: trip?.start_date ?? today(),
    end_date: trip?.end_date ?? today(),
    notes: trip?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof TripInput) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (f.end_date < f.start_date) return setErr("End date must be on or after the start date.");
        setBusy(true);
        setErr(null);
        try {
          await onSubmit({ ...f, name: f.name.trim(), destination: f.destination.trim(), notes: f.notes?.trim() || null });
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Could not save trip.");
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="t-name">Trip name</label>
        <input id="t-name" className="input" required autoFocus value={f.name} onChange={set("name")} placeholder="Summer in Italy" />
      </div>
      <div>
        <label className="label" htmlFor="t-dest">Destination</label>
        <input id="t-dest" className="input" value={f.destination} onChange={set("destination")} placeholder="Rome, Italy" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="t-start">Start date</label>
          <input
            id="t-start"
            type="date"
            className="input"
            required
            value={f.start_date}
            onChange={(e) => {
              const v = e.target.value;
              setF((p) => ({ ...p, start_date: v, end_date: p.end_date < v ? v : p.end_date }));
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="t-end">End date</label>
          <input id="t-end" type="date" className="input" required min={f.start_date} value={f.end_date} onChange={set("end_date")} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="t-notes">Notes (optional)</label>
        <textarea id="t-notes" className="input h-auto min-h-20 py-2" value={f.notes ?? ""} onChange={set("notes")} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {trip ? "Save changes" : "Create trip"}
        </button>
      </div>
    </form>
  );
}
