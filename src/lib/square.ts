// Square integration (spec §8). Phase 1 ships a MOCK that implements the same
// post-hoc-attribution interface a real Square client would, so the rest of the app
// (BAKE sales pull, demand curve) is wired correctly. When SQUARE_ACCESS_TOKEN is set,
// swap in the real client — the call sites don't change.
//
// Post-hoc attribution (§8): we don't enforce inventory at checkout. We read completed
// orders after the fact and attribute each line to flavor+format via ProductMapping.

import { dow } from "./dates";

export interface SquareSoldLine {
  flavorId: number;
  sold: number;
  /** "HH:MM" of the last sale attributed to this flavor (proxy for sell-out time). */
  lastSaleTime: string | null;
}

export interface SquareSalesResult {
  source: "mock" | "square";
  lines: SquareSoldLine[];
  /** "HH:MM" of the last sale for the whole day, or null if nothing sold. */
  lastSaleTime: string | null;
}

export interface BakedFlavor {
  flavorId: number;
  baked: number;
}

export function isSquareConfigured(): boolean {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN);
}

/**
 * Pull sold quantities for a date, attributed per flavor. In Phase 1 this is mocked:
 * given what was baked, it simulates plausible demand by weekday so the BAKE live view
 * and forecaster have something realistic to act on.
 */
export async function pullSoldForDate(
  dateIso: string,
  baked: BakedFlavor[],
  openTime = "07:00",
  closeTime = "11:00"
): Promise<SquareSalesResult> {
  if (isSquareConfigured()) {
    // Real implementation goes here (Square Orders API + ProductMapping). Not wired in Phase 1.
    throw new Error("Real Square client not implemented yet — unset SQUARE_ACCESS_TOKEN to use the mock.");
  }
  return mockSold(dateIso, baked, openTime, closeTime);
}

// ---- mock implementation ----

// Demand intensity by weekday (relative to baked). >1 means tends to sell out.
const WEEKDAY_INTENSITY: Record<number, number> = {
  3: 0.85, // Wed — slow (the spec's "125 of 150" day)
  4: 1.25, // Thu — hot (sells out early)
  5: 1.05, // Fri
  6: 1.15, // Sat
  0: 0.95, // Sun
};

function mockSold(dateIso: string, baked: BakedFlavor[], openTime: string, closeTime: string): SquareSalesResult {
  const d = new Date(dateIso + "T00:00:00Z");
  const intensity = WEEKDAY_INTENSITY[dow(d)] ?? 1;
  const seed = hashSeed(dateIso);
  const rng = mulberry32(seed);

  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;

  let dayLast: number | null = null;
  const lines: SquareSoldLine[] = baked.map((b, i) => {
    // Per-flavor demand wobbles around the day intensity.
    const flavorJitter = 0.85 + rng() * 0.4; // 0.85..1.25
    const demand = b.baked * intensity * flavorJitter;
    const sold = Math.min(b.baked, Math.round(demand));
    const soldOut = sold >= b.baked && demand > b.baked;
    // If it sold out, last sale time is front-loaded (mornings sell fast).
    let lastSaleTime: string | null = null;
    if (sold > 0) {
      const frac = soldOut
        ? Math.pow(rng() * 0.5 + 0.4, 1.3) // 0.4..0.9 of window, front-loaded
        : 0.7 + rng() * 0.3; // didn't sell out: trailing sales near close
      const t = Math.round(openMin + frac * (closeMin - openMin));
      lastSaleTime = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
      if (dayLast == null || t > dayLast) dayLast = t;
    }
    return { flavorId: b.flavorId, sold, lastSaleTime };
  });

  const lastSaleTime =
    dayLast == null ? null : `${String(Math.floor(dayLast / 60)).padStart(2, "0")}:${String(dayLast % 60).padStart(2, "0")}`;

  return { source: "mock", lines, lastSaleTime };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
