import { test } from "node:test";
import assert from "node:assert/strict";
import { splitBagels, doughForBagels, starterForBagels, weeklySchmear } from "./calc.ts";
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
  // Plain is ~100% cream cheese, others mostly cream cheese -> total CC is a large share of total weight.
  assert.ok(r.creamCheeseTotalG > 0);
  // Doubling bagels doubles cream cheese.
  const r2 = weeklySchmear(2000, DEFAULT_SCHMEAR);
  assert.ok(Math.abs(r2.creamCheeseTotalG - 2 * r.creamCheeseTotalG) < 1e-3);
});

test("plain schmear (cream cheese only) is 100% cream cheese", () => {
  const r = weeklySchmear(1000, DEFAULT_SCHMEAR);
  const plain = r.types.find((t) => t.key === "plain")!;
  assert.ok(Math.abs(plain.creamCheeseG - plain.schmearOz * 28.349523) < 1e-3);
});
