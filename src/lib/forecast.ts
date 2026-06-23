// Forecasting engine — implements spec §7 ("how many to bake"), the de-censored
// demand method. Pure functions only (no DB), so the math is unit-testable.
//
// The core idea (spec §7): a day that SOLD OUT only tells you demand was *at least*
// what you baked — true demand is censored and higher. Averaging "sold" underestimates
// demand on your best days. So we de-censor sold-out days before aggregating, then
// recommend a high percentile of that de-censored distribution (a target service level).

import { hhmmToMin } from "./dates";

export interface ForecastConfig {
  /** Target service level: bake enough to satisfy demand on this fraction of comparable days. */
  serviceLevel: number;
  /** Exponential recency weight per step back in time (newest = weight 1). 0<decay<=1. */
  recencyDecay: number;
  /**
   * Demand-curve shape exponent k for cumShare(f)=f^k (0<k<1 => front-loaded mornings).
   * Default 0.62 reproduces the spec's example: sold out at 2.5h of a 4h window (~62.5%)
   * implies ~75% of demand had arrived, so demand ≈ baked / 0.75.
   */
  frontLoadK: number;
  /** When a day sold out but no sold-out time was recorded, assume it sold out at this fraction of the window. */
  unknownSoldOutFraction: number;
  /** Cap the de-censoring uplift so a very-early sell-out can't produce an absurd estimate. */
  maxUplift: number;
  /** Round the recommended total to the nearest multiple of this. */
  roundingIncrement: number;
}

export const DEFAULT_CONFIG: ForecastConfig = {
  serviceLevel: 0.85,
  recencyDecay: 0.85,
  frontLoadK: 0.62,
  unknownSoldOutFraction: 0.85,
  maxUplift: 2.0,
  roundingIncrement: 5,
};

export interface FlavorRecordInput {
  flavorId: number;
  baked: number;
  sold: number;
  soldOut: boolean;
  soldOutTime?: string | null;
}

export interface DayRecordInput {
  date: string; // ISO YYYY-MM-DD, oldest..newest order not required (we sort by date)
  baked: number;
  sold: number;
  soldOut: boolean;
  soldOutTime?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  /** Where the record came from: a manual bake entry, or reconstructed from Square sales. */
  source?: "manual" | "square";
  flavors: FlavorRecordInput[];
}

/** Cumulative share of a day's demand expected to have arrived by elapsed window-fraction f. */
export function cumShare(f: number, k: number): number {
  if (f <= 0) return 0;
  if (f >= 1) return 1;
  return Math.pow(f, k);
}

export interface DeCensorResult {
  demand: number;
  censored: boolean;
  /** Human note on how this estimate was derived (for the explainable UI). */
  method: string;
}

/**
 * De-censor a single (baked, sold, soldOut) observation.
 * - Not sold out  -> demand = sold (uncensored).
 * - Sold out      -> demand = baked / cumShare(fraction), capped, never below baked.
 *
 * `soldOutFraction` is (soldOutTime − open)/(close − open), or null if unknown.
 */
export function deCensorDemand(
  baked: number,
  sold: number,
  soldOut: boolean,
  soldOutFraction: number | null,
  cfg: ForecastConfig
): DeCensorResult {
  if (!soldOut) {
    return { demand: sold, censored: false, method: "sold (did not sell out)" };
  }
  const f = soldOutFraction == null ? cfg.unknownSoldOutFraction : clamp(soldOutFraction, 0.05, 1);
  const share = cumShare(f, cfg.frontLoadK);
  const raw = share > 0 ? baked / share : baked * cfg.maxUplift;
  const capped = Math.min(raw, baked * cfg.maxUplift);
  const demand = Math.max(capped, baked); // sold-out demand is at least what was baked
  const pct = Math.round((f) * 100);
  const note =
    soldOutFraction == null
      ? `sold out (time unknown; assumed ${pct}% of window) → est ${Math.round(demand)}`
      : `sold out at ${pct}% of window → est demand ${Math.round(demand)} (curve ${share.toFixed(2)})`;
  return { demand, censored: true, method: note };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Infer whether a day sold out from the time of its LAST sale (used for historical days that
 * predate bake tracking). If the last sale landed `gapMin` minutes or more before close, the shop
 * almost certainly ran out of bagels rather than coasting to closing time. Returns the inference
 * plus the sell-out time (= last sale) to feed the de-censoring curve.
 */
export function inferSoldOutFromLastSale(
  lastSaleHHMM: string | null,
  closeHHMM: string,
  gapMin: number
): { soldOut: boolean; soldOutTime: string | null } {
  if (!lastSaleHHMM) return { soldOut: false, soldOutTime: null };
  const gap = hhmmToMin(closeHHMM) - hhmmToMin(lastSaleHHMM);
  return gap >= gapMin ? { soldOut: true, soldOutTime: lastSaleHHMM } : { soldOut: false, soldOutTime: null };
}

/** Fraction of the retail window elapsed when a sell-out occurred, or null if not derivable. */
export function soldOutFraction(
  soldOutTime?: string | null,
  openTime?: string | null,
  closeTime?: string | null
): number | null {
  if (!soldOutTime || !openTime || !closeTime) return null;
  const open = hhmmToMin(openTime);
  const close = hhmmToMin(closeTime);
  const so = hhmmToMin(soldOutTime);
  const win = close - open;
  if (win <= 0) return null;
  return clamp((so - open) / win, 0.05, 1);
}

/** Weighted percentile of values. weights need not be normalized. p in [0,1]. */
export function weightedPercentile(values: number[], weights: number[], p: number): number {
  if (values.length === 0) return 0;
  const pairs = values
    .map((v, i) => ({ v, w: weights[i] ?? 1 }))
    .sort((a, b) => a.v - b.v);
  const total = pairs.reduce((s, x) => s + x.w, 0);
  if (total <= 0) return pairs[pairs.length - 1].v;
  // Use cumulative-midpoint positions for a stable weighted percentile with interpolation.
  let cum = 0;
  const points = pairs.map((x) => {
    const mid = (cum + x.w / 2) / total;
    cum += x.w;
    return { pos: mid, v: x.v };
  });
  if (p <= points[0].pos) return points[0].v;
  if (p >= points[points.length - 1].pos) return points[points.length - 1].v;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (p >= a.pos && p <= b.pos) {
      const t = (p - a.pos) / (b.pos - a.pos);
      return a.v + t * (b.v - a.v);
    }
  }
  return points[points.length - 1].v;
}

export function roundTo(x: number, inc: number): number {
  if (inc <= 0) return Math.round(x);
  return Math.round(x / inc) * inc;
}

export interface RecordAnalysis {
  date: string;
  baked: number;
  sold: number;
  soldOut: boolean;
  soldOutTime?: string | null;
  deCensoredDemand: number;
  censored: boolean;
  method: string;
  weight: number;
  source: "manual" | "square";
}

export interface FlavorRecommendation {
  flavorId: number;
  recommendedQty: number;
  /** Recency-weighted de-censored demand for this flavor (pre-allocation). */
  weightedDemand: number;
  share: number;
  soldOutCount: number;
}

export interface ForecastResult {
  recommendedTotal: number;
  /** Records analyzed, newest first, with de-censored demand and weights. */
  records: RecordAnalysis[];
  perFlavor: FlavorRecommendation[];
  soldOutCount: number;
  sampleSize: number;
  /** Plain-English explanation (spec §7 build note: "an explanation you trust beats a black box"). */
  reasoning: string;
  config: ForecastConfig;
}

/**
 * Produce a recommended total + per-flavor split for one weekday from its trailing
 * same-weekday history. `records` should already be filtered to the target weekday.
 */
export function forecastWeekday(records: DayRecordInput[], cfg: ForecastConfig = DEFAULT_CONFIG): ForecastResult {
  // Newest first.
  const sorted = [...records].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (sorted.length === 0) {
    return {
      recommendedTotal: 0,
      records: [],
      perFlavor: [],
      soldOutCount: 0,
      sampleSize: 0,
      reasoning: "No same-weekday history yet — enter a few bake records to get a recommendation.",
      config: cfg,
    };
  }

  const analyses: RecordAnalysis[] = sorted.map((r, idx) => {
    const frac = soldOutFraction(r.soldOutTime, r.openTime, r.closeTime);
    const dc = deCensorDemand(r.baked, r.sold, r.soldOut, frac, cfg);
    return {
      date: r.date,
      baked: r.baked,
      sold: r.sold,
      soldOut: r.soldOut,
      soldOutTime: r.soldOutTime ?? null,
      deCensoredDemand: dc.demand,
      censored: dc.censored,
      method: dc.method,
      weight: Math.pow(cfg.recencyDecay, idx), // idx 0 = newest = weight 1
      source: r.source ?? "manual",
    };
  });

  const demands = analyses.map((a) => a.deCensoredDemand);
  const weights = analyses.map((a) => a.weight);
  const rawRec = weightedPercentile(demands, weights, cfg.serviceLevel);
  const recommendedTotal = Math.max(0, roundTo(rawRec, cfg.roundingIncrement));

  // Per-flavor: recency-weighted de-censored demand, then allocate the total by share.
  const flavorIds = uniqueFlavorIds(sorted);
  const flavorAgg = new Map<number, { wDemand: number; wSum: number; soldOut: number }>();
  for (const id of flavorIds) flavorAgg.set(id, { wDemand: 0, wSum: 0, soldOut: 0 });

  sorted.forEach((day, idx) => {
    const w = Math.pow(cfg.recencyDecay, idx);
    const dayFrac = soldOutFraction(day.soldOutTime, day.openTime, day.closeTime);
    for (const f of day.flavors) {
      const agg = flavorAgg.get(f.flavorId);
      if (!agg) continue;
      // Per-flavor sell-out time falls back to the day's sell-out fraction if not separately recorded.
      const frac = soldOutFraction(f.soldOutTime, day.openTime, day.closeTime) ?? (f.soldOut ? dayFrac : null);
      const dc = deCensorDemand(f.baked, f.sold, f.soldOut, frac, cfg);
      agg.wDemand += dc.demand * w;
      agg.wSum += w;
      if (f.soldOut) agg.soldOut += 1;
    }
  });

  const flavorDemand = flavorIds.map((id) => {
    const a = flavorAgg.get(id)!;
    return { flavorId: id, demand: a.wSum > 0 ? a.wDemand / a.wSum : 0, soldOutCount: a.soldOut };
  });
  const demandSum = flavorDemand.reduce((s, x) => s + x.demand, 0);

  // Allocate recommendedTotal across flavors by demand share, using largest-remainder
  // rounding so the per-flavor integers sum exactly to the total.
  const perFlavor = allocateByShare(flavorDemand, demandSum, recommendedTotal);

  const soldOutCount = analyses.filter((a) => a.censored).length;
  const avgDeCensored = demands.reduce((s, v) => s + v, 0) / demands.length;
  const avgSold = analyses.reduce((s, a) => s + a.sold, 0) / analyses.length;

  const reasoning = buildReasoning({
    weekdayCount: analyses.length,
    avgSold,
    avgDeCensored,
    soldOutCount,
    serviceLevel: cfg.serviceLevel,
    recommendedTotal,
  });

  return {
    recommendedTotal,
    records: analyses,
    perFlavor,
    soldOutCount,
    sampleSize: analyses.length,
    reasoning,
    config: cfg,
  };
}

function uniqueFlavorIds(days: DayRecordInput[]): number[] {
  const set = new Set<number>();
  for (const d of days) for (const f of d.flavors) set.add(f.flavorId);
  return [...set];
}

function allocateByShare(
  flavorDemand: { flavorId: number; demand: number; soldOutCount: number }[],
  demandSum: number,
  total: number
): FlavorRecommendation[] {
  if (flavorDemand.length === 0 || total === 0 || demandSum <= 0) {
    return flavorDemand.map((f) => ({
      flavorId: f.flavorId,
      recommendedQty: 0,
      weightedDemand: f.demand,
      share: 0,
      soldOutCount: f.soldOutCount,
    }));
  }
  const exact = flavorDemand.map((f) => ({
    flavorId: f.flavorId,
    share: f.demand / demandSum,
    weightedDemand: f.demand,
    soldOutCount: f.soldOutCount,
    raw: (f.demand / demandSum) * total,
  }));
  const floored = exact.map((e) => ({ ...e, base: Math.floor(e.raw), rem: e.raw - Math.floor(e.raw) }));
  let assigned = floored.reduce((s, e) => s + e.base, 0);
  let leftover = total - assigned;
  // Hand out remaining units to the largest fractional remainders.
  const order = [...floored].sort((a, b) => b.rem - a.rem);
  const bump = new Set<number>();
  for (let i = 0; i < leftover && i < order.length; i++) bump.add(order[i].flavorId);
  return floored.map((e) => ({
    flavorId: e.flavorId,
    recommendedQty: e.base + (bump.has(e.flavorId) ? 1 : 0),
    weightedDemand: e.weightedDemand,
    share: e.share,
    soldOutCount: e.soldOutCount,
  }));
}

function buildReasoning(p: {
  weekdayCount: number;
  avgSold: number;
  avgDeCensored: number;
  soldOutCount: number;
  serviceLevel: number;
  recommendedTotal: number;
}): string {
  const lvl = Math.round(p.serviceLevel * 100);
  const soldPart =
    p.soldOutCount > 0
      ? ` ${p.soldOutCount} of them sold out, so true demand was higher than baked on those days — de-censored, the average rises to ~${Math.round(p.avgDeCensored)}.`
      : " None sold out, so sold ≈ true demand.";
  return (
    `Recommended ${p.recommendedTotal}. Over the last ${p.weekdayCount} same-weekday records, ` +
    `you sold an average of ~${Math.round(p.avgSold)}.${soldPart} ` +
    `Targeting a ${lvl}% service level (a high day, weighted toward recent weeks), ` +
    `that lands at ${p.recommendedTotal}.`
  );
}
