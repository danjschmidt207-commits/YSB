import { test } from "node:test";
import assert from "node:assert/strict";
import { modifierUnitQty } from "./squareCount.ts";

// COUNTING RULE: a Square modifier's quantity is PER LINE-UNIT, so the bagels/tubs it represents
// is modifier.quantity × line.quantity. Verified against the operator's Square item export.
test("a single bagel: modifier qty 1, line qty 1 -> 1", () => {
  assert.equal(modifierUnitQty("1", "1"), 1);
  assert.equal(modifierUnitQty(undefined, undefined), 1);
});

test("Single ×2 with one flavor modifier -> 2 bagels", () => {
  assert.equal(modifierUnitQty("1", "2"), 2);
});

test("6-box (line qty 1) with 'Everything × 2' -> 2 bagels", () => {
  assert.equal(modifierUnitQty("2", "1"), 2);
});

test("two 6-boxes: 'Everything × 2' on a line of qty 2 -> 4 bagels", () => {
  assert.equal(modifierUnitQty("2", "2"), 4);
});

test("missing/garbage quantities fall back to 1 (never 0 or negative)", () => {
  assert.equal(modifierUnitQty("0", "1"), 1);
  assert.equal(modifierUnitQty("-3", "2"), 2); // bad mod qty -> 1, × line 2
  assert.equal(modifierUnitQty("abc", "1"), 1);
});
