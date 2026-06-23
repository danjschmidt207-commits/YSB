import { test } from "node:test";
import assert from "node:assert/strict";
import { inferSoldOutFromLastSale } from "./forecast";
import { zonedDateISO, zonedTimeHHMM } from "./dates";

// --- sold-out inference from the last sale time (historical, pre-tracking days) ---
test("last sale well before close (>= gap) => sold out, time = last sale", () => {
  const r = inferSoldOutFromLastSale("11:05", "12:00", 20); // 55 min before noon
  assert.equal(r.soldOut, true);
  assert.equal(r.soldOutTime, "11:05");
});

test("last sale right up against close => not sold out", () => {
  const r = inferSoldOutFromLastSale("11:55", "12:00", 20); // 5 min before noon
  assert.equal(r.soldOut, false);
  assert.equal(r.soldOutTime, null);
});

test("gap exactly at threshold counts as sold out", () => {
  assert.equal(inferSoldOutFromLastSale("11:40", "12:00", 20).soldOut, true);
});

test("no sales => not sold out", () => {
  const r = inferSoldOutFromLastSale(null, "12:00", 20);
  assert.equal(r.soldOut, false);
  assert.equal(r.soldOutTime, null);
});

// --- timezone bucketing: a late-night-UTC instant belongs to the prior Mountain day ---
test("UTC instant maps to the correct Mountain calendar day", () => {
  // 2026-06-22T03:30:00Z is 2026-06-21 21:30 in America/Denver (MDT, UTC-6).
  const instant = new Date("2026-06-22T03:30:00Z");
  assert.equal(zonedDateISO(instant, "America/Denver"), "2026-06-21");
  assert.equal(zonedTimeHHMM(instant, "America/Denver"), "21:30");
});

test("a morning sale stays on the same local day", () => {
  // 2026-06-21T16:00:00Z is 2026-06-21 10:00 in America/Denver.
  const instant = new Date("2026-06-21T16:00:00Z");
  assert.equal(zonedDateISO(instant, "America/Denver"), "2026-06-21");
  assert.equal(zonedTimeHHMM(instant, "America/Denver"), "10:00");
});
