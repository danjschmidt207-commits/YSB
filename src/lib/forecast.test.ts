import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cumShare,
  deCensorDemand,
  soldOutFraction,
  weightedPercentile,
  forecastWeekday,
  DEFAULT_CONFIG,
  type DayRecordInput,
} from "./forecast.ts";

test("cumShare reproduces the spec's ~75%-by-2.5h example", () => {
  // 2.5h of a 4h window = 0.625 elapsed; spec says ~75% of demand has arrived.
  const share = cumShare(0.625, DEFAULT_CONFIG.frontLoadK);
  assert.ok(Math.abs(share - 0.75) < 0.02, `expected ~0.75, got ${share}`);
});

test("uncensored day: demand equals sold", () => {
  const r = deCensorDemand(150, 125, false, null, DEFAULT_CONFIG);
  assert.equal(r.demand, 125);
  assert.equal(r.censored, false);
});

test("censored day: spec example baked 150, sold out at 2.5/4h ~> ~200", () => {
  // Clean 4h window: open 07:00, close 11:00, sold out 09:30 => 2.5h => 0.625 elapsed.
  const f = soldOutFraction("09:30", "07:00", "11:00");
  assert.ok(f && Math.abs(f - 0.625) < 1e-6);
  const r = deCensorDemand(150, 150, true, f, DEFAULT_CONFIG);
  assert.ok(r.demand > 195 && r.demand < 205, `expected ~200, got ${r.demand}`);
  assert.equal(r.censored, true);
  // A sell-out recorded after close clamps to the full window (fraction 1), not null.
  assert.equal(soldOutFraction("11:30", "07:00", "11:00"), 1);
});

test("de-censored demand is never below baked on a sell-out", () => {
  const r = deCensorDemand(150, 150, true, 0.99, DEFAULT_CONFIG); // sold out right at close
  assert.ok(r.demand >= 150);
});

test("uplift is capped for absurdly early sell-outs", () => {
  const r = deCensorDemand(100, 100, true, 0.05, DEFAULT_CONFIG);
  assert.ok(r.demand <= 100 * DEFAULT_CONFIG.maxUplift + 1e-9);
});

test("weightedPercentile: equal weights behaves like a percentile", () => {
  const vals = [10, 20, 30, 40, 50];
  const w = [1, 1, 1, 1, 1];
  const p90 = weightedPercentile(vals, w, 0.9);
  assert.ok(p90 >= 40, `p90 should be high, got ${p90}`);
});

test("forecast lifts the recommendation above plain sold-average when sell-outs exist", () => {
  // Build 8 Thursdays that all sold out early (censored) at baked=150.
  const records: DayRecordInput[] = [];
  for (let i = 0; i < 8; i++) {
    const day = String(4 + i).padStart(2, "0");
    records.push({
      date: `2026-06-${day}`,
      baked: 150,
      sold: 150,
      soldOut: true,
      soldOutTime: "09:30",
      openTime: "07:00",
      closeTime: "11:00",
      flavors: [
        { flavorId: 1, baked: 90, sold: 90, soldOut: true, soldOutTime: "09:00" },
        { flavorId: 2, baked: 60, sold: 60, soldOut: true, soldOutTime: "10:00" },
      ],
    });
  }
  const res = forecastWeekday(records, DEFAULT_CONFIG);
  // Plain sold-average is 150; de-censored recommendation must exceed it.
  assert.ok(res.recommendedTotal > 150, `expected >150, got ${res.recommendedTotal}`);
  // Per-flavor allocation sums exactly to the total.
  const sum = res.perFlavor.reduce((s, f) => s + f.recommendedQty, 0);
  assert.equal(sum, res.recommendedTotal);
  // Everything (flavor 1) sold out earlier, so it should get the larger share.
  const f1 = res.perFlavor.find((f) => f.flavorId === 1)!;
  const f2 = res.perFlavor.find((f) => f.flavorId === 2)!;
  assert.ok(f1.recommendedQty >= f2.recommendedQty);
});

test("forecast on a never-sell-out weekday tracks the sold distribution, not inflated", () => {
  const records: DayRecordInput[] = [];
  const sells = [120, 110, 130, 125, 100, 140, 115, 122];
  for (let i = 0; i < 8; i++) {
    const day = String(3 + i).padStart(2, "0");
    records.push({
      date: `2026-06-${day}`,
      baked: 150,
      sold: sells[i],
      soldOut: false,
      openTime: "07:00",
      closeTime: "11:00",
      flavors: [{ flavorId: 1, baked: 150, sold: sells[i], soldOut: false }],
    });
  }
  const res = forecastWeekday(records, DEFAULT_CONFIG);
  // Should sit at a high percentile of sold (~130-145), never above the max sold by much.
  assert.ok(res.recommendedTotal >= 125 && res.recommendedTotal <= 150, `got ${res.recommendedTotal}`);
  assert.equal(res.soldOutCount, 0);
});

test("empty history yields a zero recommendation with guidance", () => {
  const res = forecastWeekday([], DEFAULT_CONFIG);
  assert.equal(res.recommendedTotal, 0);
  assert.match(res.reasoning, /No same-weekday history/);
});
