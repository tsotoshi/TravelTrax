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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-[backdrop_.15s_ease-out] bg-black/40 backdrop-blur-[3px] dark:bg-black/65" onClick={onClose} />
      <div
        className={`relative max-h-[92dvh] w-full animate-[sheet_.22s_cubic-bezier(.2,.8,.2,1)] overflow-y-auto rounded-t-2xl border border-b-0 border-edge bg-surface px-5 pt-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-pop)] sm:rounded-2xl sm:border-b sm:px-6 sm:pt-5 sm:pb-6 ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-edge-strong sm:hidden" aria-hidden="true" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <button className="btn btn-ghost -mr-2 size-8 px-0 sm:size-8" onClick={onClose} aria-label="Close">
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
      className={`inline-flex shrink-0 items-center justify-center ${size === "sm" ? "size-6 rounded-md" : "size-7 rounded-md"}`}
      style={{ backgroundColor: `${c.color}1a`, color: c.color }}
      title={c.label}
    >
      <Icon name={c.icon} className={size === "sm" ? "size-3.5" : "size-[15px]"} />
    </span>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: string }) {
  return (
    <div className="card p-4">
      <div className="eyebrow flex items-center gap-1.5">
        <Icon name={icon} className="size-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
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
  if (!items.length || max === 0) return <p className="py-6 text-center text-[13px] text-muted">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key}>
          <div className="mb-1 flex h-6 items-center justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate">{i.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {i.display}
              {i.sub && <span className="ml-1.5 inline-block w-8 text-right text-xs font-normal text-muted">{i.sub}</span>}
            </span>
          </div>
          <div className="h-[3px] overflow-hidden rounded-full bg-subtle">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
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
  if (!data.length) return <p className="py-6 text-center text-[13px] text-muted">No trips yet</p>;
  return (
    <div className="flex flex-1 items-stretch">
      {data.map((d) => {
        const active = selected === "all" || selected === d.year;
        const on = selected === d.year;
        return (
          <button
            key={d.year}
            onClick={() => onSelect(selected === d.year ? "all" : d.year)}
            className="group flex min-w-0 flex-1 flex-col justify-end rounded-md focus-visible:outline-2 focus-visible:outline-accent"
            title={`${d.year}: ${usd(Math.round(d.cash))} · ${pts(d.points)} pts`}
          >
            <div className="flex h-24 items-end justify-center px-1.5 pt-4 sm:px-2.5">
              <div
                className={`relative w-full max-w-6 rounded-t-[3px] transition-[height,background-color,opacity] duration-300 ${active ? "bg-accent" : "bg-edge-strong"} group-hover:opacity-85`}
                style={{ height: `${Math.max((d.cash / max) * 100, 2)}%` }}
              >
                <span
                  className={`absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 text-[10.5px] font-medium whitespace-nowrap tabular-nums ${active ? "text-fg" : "text-faint"}`}
                >
                  {usd(Math.round(d.cash))}
                </span>
              </div>
            </div>
            <span
              className={`border-t border-line pt-1.5 text-center text-[11px] tabular-nums transition-colors ${on ? "font-semibold text-accent-ink" : "text-muted group-hover:text-fg"}`}
            >
              {d.year}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A compact metric: small label over a large number (trip and category totals). */
export function StatBox({ label, value, note, size = "md" }: { label: string; value: string; note?: string | null; size?: "md" | "lg" }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow truncate">{label}</div>
      <div className={`mt-1 truncate font-semibold tracking-[-0.025em] tabular-nums ${size === "lg" ? "text-[28px] leading-none sm:text-[32px]" : "text-xl leading-tight"}`}>
        {value}
      </div>
      {note && <div className="mt-1 truncate text-[11px] text-muted">{note}</div>}
    </div>
  );
}

/** Key for CategoryStrip: a colored dot and short name per category with spending. */
export function CategoryLegend({ parts }: { parts: { category: Category; cash: number }[] }) {
  const shown = parts.filter((p) => p.cash > 0);
  if (!shown.length) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-muted">
      {shown.map((p) => (
        <li key={p.category} className="flex items-center gap-1">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: CATEGORY_MAP[p.category].color }} />
          {CATEGORY_MAP[p.category].short}
        </li>
      ))}
    </ul>
  );
}

/** Stacked bar showing category mix. */
export function CategoryStrip({ parts }: { parts: { category: Category; cash: number }[] }) {
  const total = parts.reduce((s, p) => s + p.cash, 0);
  if (!total) return <div className="h-1 rounded-full bg-subtle" />;
  return (
    <div className="flex h-1 gap-px overflow-hidden rounded-full">
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
        <div className="popover absolute right-0 z-20 mt-1.5 w-44">
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
      <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg border border-edge bg-subtle text-muted">
        <Icon name={icon} className="size-5" />
      </span>
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      <div className="mt-1 max-w-sm text-[13px] text-muted">{children}</div>
    </div>
  );
}
