import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContext, attributeLine, attributeModifier, IGNORE } from "./attribute.ts";

const ctx = buildContext(
  [ { id: 1, name: "Everything" }, { id: 2, name: "Plain" }, { id: 5, name: "Rotator" } ],
  [ { key: "plain", name: "Plain" }, { key: "lox_dill", name: "Lox & Dill" } ],
  { "jalapeño cheddar": 5, "napkin": IGNORE }
);

test("flavor modifier maps to flavor id", () => {
  const r = attributeLine(["Everything"], ctx);
  assert.equal(r.flavorId, 1);
  assert.equal(r.schmearKey, null);
});

test("flavor + schmear on one line", () => {
  const r = attributeLine(["Everything", "Lox & Dill Schmear"], ctx);
  assert.equal(r.flavorId, 1);
  assert.equal(r.schmearKey, "lox_dill");
});

test("override maps custom rotator name to the rotator flavor", () => {
  const r = attributeLine(["Jalapeño Cheddar"], ctx);
  assert.equal(r.flavorId, 5);
});

test("ignored modifier is skipped; unknown surfaces as unmapped", () => {
  const r = attributeLine(["Napkin", "Sesame"], ctx);
  assert.equal(r.flavorId, null);
  assert.deepEqual(r.unmapped, ["Sesame"]);
});

test("schmear override maps a modifier (Butter) to a schmear key", () => {
  const c = buildContext(
    [{ id: 1, name: "Everything" }],
    [{ key: "butter", name: "Butter" }],
    { butter: "schmear:butter" }
  );
  const r = attributeLine(["Everything", "Butter"], c);
  assert.equal(r.flavorId, 1);
  assert.equal(r.schmearKey, "butter");
  assert.deepEqual(r.unmapped, []);
});

// --- per-modifier attribution against the operator's REAL Square modifier names ---
const real = buildContext(
  [
    { id: 1, name: "Everything" },
    { id: 2, name: "Plain" },
    { id: 3, name: "Asiago" },
    { id: 4, name: "Salt" },
    { id: 5, name: "Rotator" },
  ],
  [
    { key: "plain", name: "Plain" },
    { key: "bacon_scallion", name: "Bacon & Scallion" },
    { key: "chive_herb", name: "Chive & Herb" },
    { key: "lox_dill", name: "Lox & Dill" },
    { key: "butter", name: "Butter" },
  ],
  { sesame: 5, "cheddar jalepeño": 5, "cinnamon sugar": 5, "poppy seed": 5 } // rotators -> Rotator
);

test("attributeModifier resolves real bagel flavors and rotators", () => {
  assert.equal(attributeModifier("Everything", real).flavorId, 1);
  assert.equal(attributeModifier("Asiago", real).flavorId, 3);
  assert.equal(attributeModifier("Cheddar Jalepeño", real).flavorId, 5); // rotator override
  assert.equal(attributeModifier("Poppy Seed", real).flavorId, 5);
});

test("attributeModifier resolves real schmear names (Plain CC, Butter)", () => {
  assert.equal(attributeModifier("Plain CC", real).schmearKey, "plain");
  assert.equal(attributeModifier("Plain CC (Dairy-Free)", real).schmearKey, "plain");
  assert.equal(attributeModifier("Bacon & Scallion", real).schmearKey, "bacon_scallion");
  assert.equal(attributeModifier("Butter", real).schmearKey, "butter");
});

test("attributeModifier flags irrelevant options as unmapped", () => {
  for (const name of ["None", "Milk", "Sugar", "Extra", "Light"]) {
    const r = attributeModifier(name, real);
    assert.equal(r.mapped, false, `${name} should be unmapped`);
  }
});

test("a 6-box expands to correct per-flavor bagel counts", () => {
  // "Plain, Everything × 2, Asiago × 3, Chive & Herb" => 6 bagels + 1 schmear
  const mods = [
    { name: "Plain", qty: 1 },
    { name: "Everything", qty: 2 },
    { name: "Asiago", qty: 3 },
    { name: "Chive & Herb", qty: 1 },
  ];
  const flavorCounts = new Map<number, number>();
  let schmears = 0;
  for (const m of mods) {
    const a = attributeModifier(m.name, real);
    if (a.flavorId != null) flavorCounts.set(a.flavorId, (flavorCounts.get(a.flavorId) ?? 0) + m.qty);
    if (a.schmearKey != null) schmears += m.qty;
  }
  assert.equal([...flavorCounts.values()].reduce((s, x) => s + x, 0), 6); // 6 bagels
  assert.equal(flavorCounts.get(1), 2); // Everything
  assert.equal(flavorCounts.get(3), 3); // Asiago
  assert.equal(flavorCounts.get(2), 1); // Plain
  assert.equal(schmears, 1); // Chive & Herb
});
