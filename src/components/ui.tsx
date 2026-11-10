"use client";

import { useEffect, useState, type ReactNode } from "react";
import { pts, usd } from "@/lib/format";
import { CATEGORY_MAP, type Category } from "@/lib/types";
import { exportCsv, exportXlsx } from "@/lib/spreadsheet";
import type { Expense, Trip } from "@/lib/types";
import { Icon } from "./Icon";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl dark:bg-zinc-900 ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn btn-ghost -mr-2 size-9 px-0" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CategoryIcon({ category, size = "md" }: { category: Category; size?: "sm" | "md" }) {
  const c = CATEGORY_MAP[category];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl ${size === "sm" ? "size-7" : "size-9"}`}
      style={{ backgroundColor: `${c.color}1f`, color: c.color }}
      title={c.label}
    >
      <Icon name={c.icon} className={size === "sm" ? "size-3.5" : "size-[18px]"} />
    </span>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: string }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <Icon name={icon} className="size-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</div>}
    </div>
  );
}

export interface BarItem {
  key: string;
  label: ReactNode;
  value: number;
  display: string;
  sub?: string;
  color?: string;
}

export function BarList({ items, empty = "Nothing yet" }: { items: BarItem[]; empty?: string }) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (!items.length || max === 0) return <p className="py-6 text-center text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{i.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {i.display}
              {i.sub && <span className="ml-1.5 text-xs font-normal text-zinc-500">{i.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max((i.value / max) * 100, 1.5)}%`, backgroundColor: i.color ?? "var(--accent)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function YearChart({
  data,
  selected,
  onSelect,
}: {
  data: { year: string; cash: number; points: number }[];
  selected: string;
  onSelect: (y: string) => void;
}) {
  const max = Math.max(...data.map((d) => d.cash), 1);
  if (!data.length) return <p className="py-6 text-center text-sm text-zinc-500">No trips yet</p>;
  return (
    <div className="flex min-h-44 flex-1 items-end gap-2 sm:gap-3">
      {data.map((d) => {
        const active = selected === "all" || selected === d.year;
        return (
          <button
            key={d.year}
            onClick={() => onSelect(selected === d.year ? "all" : d.year)}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
            title={`${d.year}: ${usd(Math.round(d.cash))} · ${pts(d.points)} pts`}
          >
            <span className="text-[11px] font-medium tabular-nums text-zinc-600 dark:text-zinc-300">{usd(Math.round(d.cash))}</span>
            <div
              className={`w-full max-w-14 rounded-lg transition-all group-hover:opacity-80 ${active ? "" : "opacity-30"}`}
              style={{ height: `${Math.max((d.cash / max) * 100, 2)}%`, backgroundColor: "var(--accent)" }}
            />
            <span className={`text-xs ${selected === d.year ? "font-semibold text-[var(--accent)]" : "text-zinc-500"}`}>{d.year}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A light box with a small label over a large number (trip and category totals). */
export function StatBox({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="min-w-0 rounded-2xl bg-zinc-100/80 px-3.5 py-2.5 dark:bg-zinc-800/70">
      <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-0.5 truncate text-xl font-semibold tracking-tight tabular-nums">{value}</div>
      {note && <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{note}</div>}
    </div>
  );
}

/** Key for CategoryStrip: a colored dot and short name per category with spending. */
export function CategoryLegend({ parts }: { parts: { category: Category; cash: number }[] }) {
  const shown = parts.filter((p) => p.cash > 0);
  if (!shown.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
      {shown.map((p) => (
        <li key={p.category} className="flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ backgroundColor: CATEGORY_MAP[p.category].color }} />
          {CATEGORY_MAP[p.category].short}
        </li>
      ))}
    </ul>
  );
}

/** Stacked bar showing category mix. */
export function CategoryStrip({ parts }: { parts: { category: Category; cash: number }[] }) {
  const total = parts.reduce((s, p) => s + p.cash, 0);
  if (!total) return <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800" />;
  return (
    <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
      {parts
        .filter((p) => p.cash > 0)
        .map((p) => (
          <div key={p.category} style={{ width: `${(p.cash / total) * 100}%`, backgroundColor: CATEGORY_MAP[p.category].color }} />
        ))}
    </div>
  );
}

export function ExportMenu({ filename, trips, expenses, buttonClass = "btn btn-secondary", iconOnly }: { filename: string; trips: Trip[]; expenses: Expense[]; buttonClass?: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <div className="relative">
      <button
        className={buttonClass}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Icon name="download" />
        {!iconOnly && <span className="hidden sm:inline">Export</span>}
      </button>
      {open && (
        <div className="card absolute right-0 z-20 mt-1.5 w-44 p-1 text-zinc-900 shadow-xl dark:text-zinc-100">
          <button className="menu-item" onClick={() => exportCsv(filename, trips, expenses)}>
            CSV (.csv)
          </button>
          <button
            className="menu-item"
            onClick={async () => {
              setBusy(true);
              try {
                await exportXlsx(filename, trips, expenses);
              } finally {
                setBusy(false);
              }
            }}
          >
            Excel (.xlsx)
          </button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
        <Icon name={icon} className="size-6" />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-1 text-sm text-zinc-500">{children}</div>
    </div>
  );
}
