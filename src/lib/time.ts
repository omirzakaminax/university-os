/**
 * Timezone-aware date helpers built on Intl (no date library needed).
 * All persisted instants are UTC (`timestamptz`); the user's IANA timezone is applied only at the edges.
 */

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, tz: string): ZonedParts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(date)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour!, minute: p.minute!, second: p.second! };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** 'YYYY-MM-DD' for the given instant in the given timezone. */
export function dateInTz(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

export const todayInTz = (tz: string, now: Date = new Date()) => dateInTz(now, tz);

/** Offset (ms) of `tz` from UTC at the given instant. */
function offsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Convert a wall-clock time in `tz` ('YYYY-MM-DDTHH:mm' or 'YYYY-MM-DD') to a UTC ISO string.
 * Across DST gaps the result is the nearest valid instant after the gap.
 */
export function zonedLocalToUtc(local: string, tz: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(local);
  if (!m) throw new Error(`Invalid local date-time: ${local}`);
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  let guess = naive - offsetMs(new Date(naive), tz);
  // Re-evaluate once: the offset at the guessed instant may differ across a DST boundary.
  guess = naive - offsetMs(new Date(guess), tz);
  return new Date(guess).toISOString();
}

/** Inverse of zonedLocalToUtc for <input type="datetime-local">: 'YYYY-MM-DDTHH:mm'. */
export function utcToZonedLocalInput(iso: string, tz: string): string {
  const p = zonedParts(new Date(iso), tz);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** ISO weekday of a calendar date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** [start, end) of a local calendar day expressed as UTC ISO strings. */
export function dayBoundsUtc(dateStr: string, tz: string): { start: string; end: string } {
  return { start: zonedLocalToUtc(dateStr, tz), end: zonedLocalToUtc(addDays(dateStr, 1), tz) };
}

/** Monday-based (or `weekStartsOn`) week start containing `dateStr`. weekStartsOn: 0 = Sunday … 6. */
export function startOfWeek(dateStr: string, weekStartsOn = 1): string {
  const wd = isoWeekday(dateStr) % 7; // 0 = Sunday
  const diff = (wd - weekStartsOn + 7) % 7;
  return addDays(dateStr, -diff);
}

/** Whole calendar days from `a` to `b` (positive if b is later). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number) as [number, number, number];
  const [by, bm, bd] = b.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export type DueState = "overdue" | "today" | "tomorrow" | "soon" | "later" | "none";

/** Describe a due instant relative to now in the user's timezone. */
export function describeDue(iso: string | null | undefined, tz: string, now: Date = new Date()): { state: DueState; label: string } {
  if (!iso) return { state: "none", label: "No due date" };
  const due = new Date(iso);
  const days = diffDays(dateInTz(now, tz), dateInTz(due, tz));
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(due);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(due);
  if (due.getTime() < now.getTime()) {
    return { state: "overdue", label: days === 0 ? `Overdue · today ${time}` : `Overdue · ${day}` };
  }
  if (days === 0) return { state: "today", label: `Today ${time}` };
  if (days === 1) return { state: "tomorrow", label: `Tomorrow ${time}` };
  if (days <= 7) return { state: "soon", label: `${day} ${time}` };
  return { state: "later", label: `${day}` };
}
