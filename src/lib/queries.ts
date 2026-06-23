import { prisma } from "./db";
import { isoDate, zonedTimeHHMM, weekStartWednesday, openWeekDates, dow } from "./dates";
import { inferSoldOutFromLastSale, type DayRecordInput } from "./forecast";
import { RETAIL_TIMEZONE, SOLDOUT_INFERENCE } from "./config";
import { splitBagels, boardsForBagels } from "./calc";

export async function getActiveFlavors() {
  return prisma.flavor.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } });
}

export async function getBakeRecord(date: Date) {
  return prisma.bakeRecord.findUnique({
    where: { date },
    include: { lines: { include: { flavor: true } } },
  });
}

/**
 * One day's sales reconstructed from Square, with sold-out inferred from the last-sale time.
 * Used for historical days that predate manual bake tracking. `baked` is unknown pre-tracking, so
 * we use sold as its floor (on sell-out days the de-censoring curve lifts demand above it).
 */
export interface SquareDayAgg extends DayRecordInput {
  dow: number;
  source: "square";
  /** Local wall-clock time (HH:MM) of the day's last sale, or null if none. */
  lastSale: string | null;
}

/** Aggregate all imported Square sales into per-day records with inferred sell-out. */
export async function loadSquareDayAggregates(): Promise<SquareDayAgg[]> {
  const [byDate, byDateFlavor] = await Promise.all([
    prisma.squareSale.groupBy({
      by: ["date", "dayOfWeek"],
      where: { flavorId: { not: null } },
      _sum: { qty: true },
      _max: { soldAt: true },
    }),
    prisma.squareSale.groupBy({
      by: ["date", "flavorId"],
      where: { flavorId: { not: null } },
      _sum: { qty: true },
    }),
  ]);

  const flavorsByDate = new Map<string, { flavorId: number; qty: number }[]>();
  for (const g of byDateFlavor) {
    const k = isoDate(g.date);
    const arr = flavorsByDate.get(k) ?? [];
    arr.push({ flavorId: g.flavorId as number, qty: g._sum.qty ?? 0 });
    flavorsByDate.set(k, arr);
  }

  const { openTime, closeTime, gapMinutes } = SOLDOUT_INFERENCE;
  return byDate.map((g) => {
    const dateIso = isoDate(g.date);
    const sold = g._sum.qty ?? 0;
    const lastSale = g._max.soldAt ? zonedTimeHHMM(g._max.soldAt, RETAIL_TIMEZONE) : null;
    const { soldOut, soldOutTime } = inferSoldOutFromLastSale(lastSale, closeTime, gapMinutes);
    const flavors = (flavorsByDate.get(dateIso) ?? []).map((f) => ({
      flavorId: f.flavorId,
      baked: f.qty,
      sold: f.qty,
      soldOut,
      soldOutTime,
    }));
    return {
      date: dateIso,
      dow: g.dayOfWeek,
      source: "square" as const,
      lastSale,
      baked: sold,
      sold,
      soldOut,
      soldOutTime,
      openTime,
      closeTime,
      flavors,
    };
  });
}

/**
 * Trailing same-weekday history for the forecaster. Manual BakeRecords are the source of truth;
 * for dates with no bake record we fall back to Square-derived demand (with inferred sell-out), so
 * the first weeks of operation still produce a de-censored recommendation.
 */
export async function loadWeekdayHistory(targetDow: number, limit = 8): Promise<DayRecordInput[]> {
  const [records, squareDays] = await Promise.all([
    prisma.bakeRecord.findMany({
      where: { dayOfWeek: targetDow },
      orderBy: { date: "desc" },
      include: { lines: true },
    }),
    loadSquareDayAggregates(),
  ]);
  const manual = records.map(toDayRecordInput);
  const manualDates = new Set(manual.map((m) => m.date));
  const square = squareDays.filter((s) => s.dow === targetDow && !manualDates.has(s.date));

  const combined = [...manual, ...square].sort((a, b) => (a.date < b.date ? 1 : -1));
  return combined.slice(0, limit);
}

/** Dates (YYYY-MM-DD) that sold out per the Square last-sale inference — their flavor mix is biased. */
export async function loadSoldOutDates(): Promise<Set<string>> {
  const days = await loadSquareDayAggregates();
  return new Set(days.filter((d) => d.soldOut).map((d) => d.date));
}

export function toDayRecordInput(r: {
  date: Date;
  totalBaked: number;
  totalSold: number;
  soldOut: boolean;
  soldOutTime: string | null;
  retailOpenTime: string | null;
  retailCloseTime: string | null;
  lines: { flavorId: number; qtyBaked: number; qtySold: number; flavorSoldOut: boolean; flavorSoldOutTime: string | null }[];
}): DayRecordInput {
  return {
    date: isoDate(r.date),
    baked: r.totalBaked,
    sold: r.totalSold,
    soldOut: r.soldOut,
    soldOutTime: r.soldOutTime,
    openTime: r.retailOpenTime,
    closeTime: r.retailCloseTime,
    source: "manual" as const,
    flavors: r.lines.map((l) => ({
      flavorId: l.flavorId,
      baked: l.qtyBaked,
      sold: l.qtySold,
      soldOut: l.flavorSoldOut,
      soldOutTime: l.flavorSoldOutTime,
    })),
  };
}

export async function getRecentBakeRecords(limit = 20) {
  return prisma.bakeRecord.findMany({
    orderBy: { date: "desc" },
    take: limit,
    include: { lines: true },
  });
}

export async function getIngredients() {
  return prisma.ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
}

export async function getPlanForWeek(weekStartDate: Date) {
  return prisma.weeklyPlan.findUnique({
    where: { weekStartDate },
    include: { days: { include: { lines: { include: { flavor: true } } }, orderBy: { date: "asc" } } },
  });
}

/** A single bake day's plan, split by flavor with half-board counts (for the boil & season cards). */
export interface DayPlanPreview {
  dateIso: string;
  dow: number;
  retail: number;
  wholesale: number;
  bakeTotal: number;
  hasPlan: boolean;
  rotatorName: string | null;
  flavors: { flavorId: number; name: string; qty: number; boards: number }[];
}

function buildDayPreview(
  date: Date,
  flavors: { id: number; name: string; pct: number; isRotator: boolean }[],
  plan: Awaited<ReturnType<typeof getPlanForWeek>>
): DayPlanPreview {
  const planDay = plan?.days.find((x) => isoDate(x.date) === isoDate(date));
  const retail = planDay?.plannedTotal ?? 0;
  const wholesale = planDay?.wholesaleExtra ?? 0;
  const bakeTotal = retail + wholesale;
  const pcts = flavors.map((f) => ({
    flavorId: f.id,
    name: f.isRotator && plan?.rotatorName ? plan.rotatorName : f.name,
    pct: f.pct,
  }));
  const split = splitBagels(bakeTotal, pcts).map((s) => ({ ...s, boards: boardsForBagels(s.qty) }));
  return {
    dateIso: isoDate(date),
    dow: dow(date),
    retail,
    wholesale,
    bakeTotal,
    hasPlan: !!planDay,
    rotatorName: plan?.rotatorName ?? null,
    flavors: split,
  };
}

/** All five open days of the week containing `anyDate`, each split by flavor with board counts. */
export async function getWeekDayPlans(anyDate: Date): Promise<DayPlanPreview[]> {
  const wed = weekStartWednesday(anyDate);
  const [flavors, plan] = await Promise.all([getActiveFlavors(), getPlanForWeek(wed)]);
  return openWeekDates(wed).map((d) => buildDayPreview(d, flavors, plan));
}

/** One day's plan preview (loads the week containing the date). */
export async function getDayPlan(date: Date): Promise<DayPlanPreview> {
  const [flavors, plan] = await Promise.all([getActiveFlavors(), getPlanForWeek(weekStartWednesday(date))]);
  return buildDayPreview(date, flavors, plan);
}
