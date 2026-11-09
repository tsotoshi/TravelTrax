const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-US");

/** $1,234 for whole amounts, $1,234.50 otherwise. Pass exact=true to always show cents. */
export function usd(n: number, exact = false) {
  return exact || !Number.isInteger(Math.round(n * 100) / 100) ? usd2.format(n) : usd0.format(n);
}

const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
/** Short numbers for tight spaces: 1.2K, 414K, 1.5M. */
export function compact(n: number) {
  return n < 10_000 ? num.format(Math.round(n)) : compactFmt.format(n);
}
/** Whole dollars, compact above $100K. */
export function usdShort(n: number) {
  return n < 100_000 ? usd0.format(Math.round(n)) : "$" + compactFmt.format(n);
}

export function pts(n: number) {
  return num.format(n);
}

export function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const md = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const mdy = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function fmtDate(s: string | null) {
  return s ? mdy.format(parseDate(s)) : "";
}

export function fmtShortDate(s: string | null) {
  return s ? md.format(parseDate(s)) : "";
}

export function fmtRange(start: string, end: string) {
  const a = parseDate(start);
  const b = parseDate(end);
  if (start === end) return mdy.format(a);
  if (a.getFullYear() !== b.getFullYear()) return `${mdy.format(a)} – ${mdy.format(b)}`;
  if (a.getMonth() === b.getMonth()) return `${md.format(a)} – ${b.getDate()}, ${b.getFullYear()}`;
  return `${md.format(a)} – ${md.format(b)}, ${b.getFullYear()}`;
}

export function nights(start: string, end: string) {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000);
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** RFC4122 v4 id; works in insecure contexts (e.g. LAN testing on a phone). */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto && globalThis.isSecureContext) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
