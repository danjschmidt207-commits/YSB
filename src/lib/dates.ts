// Date helpers. The bakery is open Wednesday–Sunday (closed Mon/Tue).
// We work entirely in UTC-midnight Date objects to keep weekday math stable
// regardless of server timezone — dates here represent calendar days, not instants.

export const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Day-of-week numbers the bakery is open, in display order (Wed→Sun). */
export const OPEN_DOWS = [3, 4, 5, 6, 0] as const;

export function isOpenDay(dow: number): boolean {
  return (OPEN_DOWS as readonly number[]).includes(dow);
}

/** A UTC-midnight Date for the given y/m/d (month is 1-based). */
export function utcDate(year: number, month1: number, day: number): Date {
  return new Date(Date.UTC(year, month1 - 1, day));
}

/** Strip any time component, returning UTC midnight of that calendar day. */
export function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function dow(d: Date): number {
  return d.getUTCDay();
}

/** Format a Date as YYYY-MM-DD (UTC). */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD string to a UTC-midnight Date. */
export function parseIsoDate(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return utcDate(y, m, day);
}

/** Human label e.g. "Wed, Jun 18". */
export function shortLabel(d: Date): string {
  return `${DOW_SHORT[dow(d)]}, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

/**
 * The Wednesday that starts the open-week containing `d`.
 * Wed–Sun all map back to that week's Wednesday; Mon/Tue map to the *upcoming* Wednesday.
 */
export function weekStartWednesday(d: Date): Date {
  const day = dow(d);
  // Days since the most recent Wednesday (3). For Mon(1)/Tue(2) there's no open day yet
  // this week, so roll forward to the next Wednesday instead.
  if (day === 1) return addDays(d, 2); // Mon -> Wed
  if (day === 2) return addDays(d, 1); // Tue -> Wed
  const back = (day - 3 + 7) % 7; // Wed=0, Thu=1, ... Sun=4
  return addDays(d, -back);
}

/** The five open dates (Wed–Sun) for the week starting at the given Wednesday. */
export function openWeekDates(wednesday: Date): Date[] {
  // Wed, Thu, Fri, Sat, Sun = +0,+1,+2,+3,+4
  return [0, 1, 2, 3, 4].map((n) => addDays(wednesday, n));
}

/** The next open baking day strictly after `d` (skips Mon/Tue). */
export function nextOpenDay(d: Date): Date {
  let cur = addDays(d, 1);
  while (!isOpenDay(dow(cur))) cur = addDays(cur, 1);
  return cur;
}

/** Minutes between two "HH:MM" strings (close − open). Returns null if either missing. */
export function windowMinutes(open?: string | null, close?: string | null): number | null {
  if (!open || !close) return null;
  return hhmmToMin(close) - hhmmToMin(open);
}

export function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export function minToHhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
