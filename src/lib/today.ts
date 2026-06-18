import { toUtcMidnight, parseIsoDate } from "./dates";

/**
 * The app's "today" as a UTC-midnight calendar date. Honors APP_TODAY (set in .env to keep
 * the demo aligned with seeded history); otherwise follows the system clock. Server-only.
 */
export function appToday(): Date {
  const pinned = process.env.APP_TODAY;
  if (pinned) return parseIsoDate(pinned);
  return toUtcMidnight(new Date());
}
