import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContext, attributeLine, IGNORE } from "./attribute.ts";

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
