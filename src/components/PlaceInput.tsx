"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

interface PhotonFeature {
  properties: { name?: string; state?: string; country?: string; type?: string };
}

const PLACE_TYPES = new Set(["city", "locality", "district", "county", "state", "country", "other"]);

function label(p: PhotonFeature["properties"]) {
  const parts = [p.name, p.state, p.country].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  return parts.join(", ");
}

/**
 * Destination field with place suggestions as you type (OpenStreetMap data via
 * photon.komoot.io, no API key) plus destinations you've used before.
 */
export function PlaceInput({
  id,
  value,
  onChange,
  recent = [],
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  recent?: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || q.length < 2) {
      setRemote([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lang=en`, { signal: ctrl.signal });
        const d: { features: PhotonFeature[] } = await r.json();
        const seen = new Set<string>();
        setRemote(
          d.features
            .filter((f) => PLACE_TYPES.has(f.properties.type ?? "other"))
            .map((f) => label(f.properties))
            .filter((l) => l && !seen.has(l) && seen.add(l))
            .slice(0, 6),
        );
      } catch {
        /* offline or aborted: keep recent matches only */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  const q = value.trim().toLowerCase();
  const recentMatches = recent.filter((r) => r.toLowerCase().includes(q) && r.toLowerCase() !== q).slice(0, 3);
  const options = [...recentMatches, ...remote.filter((r) => !recentMatches.includes(r))];

  const choose = (v: string) => {
    typed.current = false;
    onChange(v);
    setOpen(false);
    setRemote([]);
  };

  return (
    <div className="relative">
      <Icon name="pin" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
      <input
        id={id}
        className="input pl-10"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open || !options.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choose(options[active]);
          }
        }}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-autocomplete="list"
      />
      {loading && <span className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-300 border-t-[var(--accent)]" />}
      {open && options.length > 0 && (
        <ul role="listbox" className="card absolute inset-x-0 z-30 mt-1.5 max-h-64 overflow-auto p-1.5 shadow-xl">
          {options.map((o, i) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm ${
                  i === active ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <Icon name={recentMatches.includes(o) ? "map" : "pin"} className="size-4 shrink-0 text-zinc-400" />
                <span className="truncate">{o}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
