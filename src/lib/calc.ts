// Production calculators: bagel flavor split, dough, starter feeding, and weekly schmear.
// Pure functions (no DB) so they're unit-testable.

import { LB, OZ, type DoughRecipe, type StarterConfig, type SchmearConfig } from "./config";

// ---- bagel flavor split ----

export interface FlavorPct {
  flavorId: number;
  name: string;
  pct: number;
}

/** Split a day's total bagels across flavors by percentage, summing exactly to the total. */
export function splitBagels(total: number, flavors: FlavorPct[]): { flavorId: number; name: string; qty: number }[] {
  const pctSum = flavors.reduce((s, f) => s + f.pct, 0) || 1;
  const raw = flavors.map((f) => ({ ...f, exact: (total * f.pct) / pctSum }));
  const floored = raw.map((r) => ({ ...r, base: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let leftover = total - floored.reduce((s, r) => s + r.base, 0);
  const order = [...floored].sort((a, b) => b.rem - a.rem);
  const bump = new Set<number>();
  for (let i = 0; i < leftover && i < order.length; i++) bump.add(order[i].flavorId);
  return floored.map((r) => ({ flavorId: r.flavorId, name: r.name, qty: r.base + (bump.has(r.flavorId) ? 1 : 0) }));
}

// ---- dough ----

export interface DoughResult {
  totalDoughG: number;
  flourG: number;
  starterG: number;
  waterG: number;
  honeyG: number;
  saltG: number;
}

/** Dough required for `bagels` bagels, broken into ingredient grams via the recipe ratio. */
export function doughForBagels(bagels: number, d: DoughRecipe): DoughResult {
  const parts = d.flour + d.starter + d.water + d.honey + d.salt || 1;
  const totalDoughG = bagels * d.bagelWeightG;
  const per = (part: number) => (totalDoughG * part) / parts;
  return {
    totalDoughG,
    flourG: per(d.flour),
    starterG: per(d.starter),
    waterG: per(d.water),
    honeyG: per(d.honey),
    saltG: per(d.salt),
  };
}

// ---- starter feeding ----

export interface StarterResult {
  neededG: number; // starter the dough needs
  buildG: number; // needed + buffer
  seedG: number; // existing starter to seed the feed
  flourG: number; // flour to feed
  waterG: number; // water to feed
}

/** How much starter to build (feed) for a day's bagels, broken into seed/flour/water. */
export function starterForBagels(bagels: number, d: DoughRecipe, s: StarterConfig): StarterResult {
  const dough = doughForBagels(bagels, d);
  const neededG = dough.starterG;
  const buildG = neededG * (1 + s.bufferPct / 100);
  const ratioSum = s.seed + s.flour + s.water || 1;
  return {
    neededG,
    buildG,
    seedG: (buildG * s.seed) / ratioSum,
    flourG: (buildG * s.flour) / ratioSum,
    waterG: (buildG * s.water) / ratioSum,
  };
}

// ---- weekly schmear ----

export interface SchmearTypeResult {
  key: string;
  name: string;
  pct: number;
  schmearOz: number;
  scale: number; // multiple of the base recipe
  components: { name: string; grams: number }[];
  creamCheeseG: number;
}
export interface SchmearResult {
  weeklyBagels: number;
  totalSchmearOz: number;
  creamCheeseTotalG: number;
  creamCheeseTotalLb: number;
  types: SchmearTypeResult[];
}

/** Weekly schmear prep from total weekly bagels: per-type scaled recipes + total cream cheese. */
export function weeklySchmear(weeklyBagels: number, cfg: SchmearConfig): SchmearResult {
  const totalSchmearOz = weeklyBagels * cfg.servingOz;
  const pctSum = cfg.types.reduce((s, t) => s + t.pct, 0) || 1;

  const types: SchmearTypeResult[] = cfg.types.map((t) => {
    const schmearOz = (totalSchmearOz * t.pct) / pctSum;
    const neededG = schmearOz * OZ;
    const baseYieldG = t.components.reduce((s, c) => s + c.grams, 0) || 1;
    const scale = neededG / baseYieldG;
    const components = t.components.map((c) => ({ name: c.name, grams: c.grams * scale }));
    const creamCheeseG = components
      .filter((c) => /cream cheese/i.test(c.name))
      .reduce((s, c) => s + c.grams, 0);
    return { key: t.key, name: t.name, pct: t.pct, schmearOz, scale, components, creamCheeseG };
  });

  const creamCheeseTotalG = types.reduce((s, t) => s + t.creamCheeseG, 0);
  return {
    weeklyBagels,
    totalSchmearOz,
    creamCheeseTotalG,
    creamCheeseTotalLb: creamCheeseTotalG / LB,
    types,
  };
}

// ---- formatting helpers ----

export function g(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${Math.round(grams)} g`;
}
export function lb(grams: number): string {
  return `${(grams / LB).toFixed(1)} lb`;
}
/** Grams shown as both kg and lb (for ordering). */
export function gLb(grams: number): string {
  return `${(grams / 1000).toFixed(2)} kg (${(grams / LB).toFixed(1)} lb)`;
}
