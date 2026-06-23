import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitBagels,
  doughForBagels,
  starterForBagels,
  weeklySchmear,
  weeklyDemandGrams,
  unitGrams,
  boardsForBagels,
  formatBoards,
  creamCheeseBlocks,
  doughBatches,
} from "./calc.ts";
import { DEFAULT_DOUGH, DEFAULT_STARTER, DEFAULT_SCHMEAR, LB } from "./config.ts";

const FLAVORS = [
  { flavorId: 1, name: "Everything", pct: 40 },
  { flavorId: 2, name: "Plain", pct: 15 },
  { flavorId: 3, name: "Asiago", pct: 15 },
  { flavorId: 4, name: "Salt", pct: 15 },
  { flavorId: 5, name: "Rotator", pct: 15 },
];

test("splitBagels sums exactly to the total and honors percentages", () => {
  const out = splitBagels(150, FLAVORS);
  assert.equal(out.reduce((s, x) => s + x.qty, 0), 150);
  const everything = out.find((x) => x.flavorId === 1)!;
  assert.equal(everything.qty, 60); // 40% of 150
});

test("splitBagels handles remainders without losing bagels", () => {
  const out = splitBagels(151, FLAVORS);
  assert.equal(out.reduce((s, x) => s + x.qty, 0), 151);
});

test("dough for one bagel weighs the bagel weight and ingredients sum to it", () => {
  const d = doughForBagels(1, DEFAULT_DOUGH);
  assert.ok(Math.abs(d.totalDoughG - 160) < 1e-9);
  const sum = d.flourG + d.starterG + d.waterG + d.honeyG + d.saltG;
  assert.ok(Math.abs(sum - 160) < 1e-6, `ingredients should sum to 160, got ${sum}`);
});

test("dough scales linearly with bagel count", () => {
  const d = doughForBagels(100, DEFAULT_DOUGH);
  // flour share = 90/166.83 of total dough (100*160)
  const parts = 90 + 18 + 50 + 7 + 1.83;
  assert.ok(Math.abs(d.flourG - (100 * 160 * 90) / parts) < 1e-6);
});

test("starter build = needed + buffer, split by feed ratio summing to build", () => {
  const s = starterForBagels(100, DEFAULT_DOUGH, DEFAULT_STARTER);
  const parts = 90 + 18 + 50 + 7 + 1.83;
  const expectedNeeded = (100 * 160 * 18) / parts;
  assert.ok(Math.abs(s.neededG - expectedNeeded) < 1e-6);
  assert.ok(Math.abs(s.buildG - expectedNeeded * 1.1) < 1e-6); // 10% buffer
  assert.ok(Math.abs(s.seedG + s.flourG + s.waterG - s.buildG) < 1e-6);
  // 1:10:10 => seed is 1/21 of build
  assert.ok(Math.abs(s.seedG - s.buildG / 21) < 1e-6);
});

test("weekly schmear: cream cheese scales with bagels and serving size", () => {
  const r = weeklySchmear(1000, DEFAULT_SCHMEAR);
  assert.ok(Math.abs(r.totalSchmearOz - 1500) < 1e-9); // 1000 * 1.5oz
  assert.ok(r.creamCheeseTotalG > 0);
  // Totals are whole 3-lb blocks (cream cheese is bought as blocks).
  assert.equal(Number.isInteger(r.creamCheeseTotalBlocks), true);
  assert.equal(Math.round(r.creamCheeseTotalG / LB), r.creamCheeseTotalBlocks * 3);
  // Doubling bagels ~doubles cream cheese (within block rounding, which is tiny at this volume).
  const r2 = weeklySchmear(2000, DEFAULT_SCHMEAR);
  assert.ok(r2.creamCheeseTotalG >= 1.95 * r.creamCheeseTotalG && r2.creamCheeseTotalG <= 2.05 * r.creamCheeseTotalG);
});

test("plain schmear cream cheese is rounded to the nearest 3-lb block", () => {
  const r = weeklySchmear(1000, DEFAULT_SCHMEAR);
  const plain = r.types.find((t) => t.key === "plain")!;
  const exactBlocks = Math.round((plain.schmearOz * 28.349523) / (3 * LB));
  assert.equal(plain.creamCheeseBlocks, exactBlocks);
  assert.equal(Math.round(plain.creamCheeseG / LB), exactBlocks * 3);
});

test("boardsForBagels rounds to the nearest half board (24/board)", () => {
  assert.equal(boardsForBagels(108), 4.5);
  assert.equal(boardsForBagels(60), 2.5);
  assert.equal(boardsForBagels(36), 1.5);
  assert.equal(boardsForBagels(24), 1);
  assert.equal(boardsForBagels(30), 1.5); // 1.25 -> 1.5
  assert.equal(boardsForBagels(0), 0);
});

test("formatBoards renders halves as ½", () => {
  assert.equal(formatBoards(4.5), "4½");
  assert.equal(formatBoards(2), "2");
  assert.equal(formatBoards(0.5), "½");
  assert.equal(formatBoards(0), "0");
});

test("doughBatches splits into the fewest equal batches under the cap", () => {
  const max = 40 * LB;
  // 82 lb dough, 40 lb cap -> 3 batches (ceil(82/40)=3), each ~27.3 lb, all under cap.
  const b = doughBatches(82 * LB, max);
  assert.equal(b.count, 3);
  assert.ok(b.perBatchG / LB <= 40 + 1e-9);
  assert.ok(Math.abs(b.perBatchG * b.count - 82 * LB) < 1e-6); // batches sum to the total
  // exactly at the cap -> one batch
  assert.equal(doughBatches(40 * LB, max).count, 1);
  // just over the cap -> two batches
  assert.equal(doughBatches(40.1 * LB, max).count, 2);
  // empty day -> no batches
  assert.equal(doughBatches(0, max).count, 0);
});

test("creamCheeseBlocks rounds grams to whole 3-lb blocks", () => {
  assert.equal(creamCheeseBlocks(9 * LB).blocks, 3);
  assert.equal(creamCheeseBlocks(10 * LB).blocks, 3); // nearest
  assert.equal(creamCheeseBlocks(11 * LB).blocks, 4); // nearest
  assert.equal(Math.round(creamCheeseBlocks(11 * LB).grams / LB), 12);
});

test("weeklyDemandGrams aggregates dough + schmear by name, with salt from both", () => {
  const d = weeklyDemandGrams([100, 100], DEFAULT_DOUGH, DEFAULT_STARTER, DEFAULT_SCHMEAR);
  // flour demand = dough flour + starter feed flour for 200 bagels, > 0
  assert.ok(d["flour"] > 0);
  assert.ok(d["cream cheese"] > 0);
  // salt appears in dough AND schmear, so combined salt >= dough-only salt
  const doughSalt = doughForBagels(200, DEFAULT_DOUGH).saltG;
  assert.ok(d["salt"] >= doughSalt);
});

test("unitGrams converts weights and returns null for counts", () => {
  assert.equal(unitGrams("g"), 1);
  assert.ok(Math.abs(unitGrams("lb")! - 453.59237) < 1e-6);
  assert.equal(unitGrams("ea"), null);
});
