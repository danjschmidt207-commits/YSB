// Seed ~12 weeks of realistic Yard Sale Bagels history so the forecaster + calculators have signal.
// New model: plan a daily TOTAL; flavors derive from percentages. 4 permanent flavors + a weekly
// rotator. Open Wed–Sun, 8:00–13:00. Sales are simulated internally (no Square).

import { PrismaClient } from "@prisma/client";
import {
  addDays,
  dow,
  isoDate,
  isOpenDay,
  toUtcMidnight,
  parseIsoDate,
  weekStartWednesday,
  openWeekDates,
} from "../src/lib/dates.ts";
import { forecastWeekday, DEFAULT_CONFIG, type DayRecordInput } from "../src/lib/forecast.ts";
import { splitBagels } from "../src/lib/calc.ts";
import { applyDefaults } from "../src/lib/seedDefaults.ts";

const prisma = new PrismaClient();

const SEED_TODAY = process.env.APP_TODAY ? parseIsoDate(process.env.APP_TODAY) : toUtcMidnight(new Date());
const WEEKS_BACK = 12;
const OPEN_TIME = "08:00";
const CLOSE_TIME = "13:00";

// Base total baked per weekday (the operator's current "feel").
const WEEKDAY_BASE: Record<number, number> = { 3: 150, 4: 150, 5: 165, 6: 195, 0: 160 };
// Demand intensity vs. baked (>1 tends to sell out): Thu/Sat hot, Wed slow.
const WEEKDAY_INTENSITY: Record<number, number> = { 3: 0.85, 4: 1.25, 5: 1.05, 6: 1.15, 0: 0.95 };

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;
}

async function main() {
  const existing = await prisma.flavor.count();
  if (existing > 0) {
    console.log(`Seed skipped — database already has ${existing} flavors (not overwriting real data).`);
    return;
  }

  console.log("Applying default flavors, formats, settings…");
  await applyDefaults(prisma);

  const flavors = await prisma.flavor.findMany({ orderBy: { displayOrder: "asc" } });
  const flavorPcts = flavors.map((f) => ({ flavorId: f.id, name: f.name, pct: f.pct }));

  const [oh, om] = OPEN_TIME.split(":").map(Number);
  const [ch, cm] = CLOSE_TIME.split(":").map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;

  const start = addDays(weekStartWednesday(SEED_TODAY), -7 * WEEKS_BACK);
  console.log(`Generating bake history ${isoDate(start)} … ${isoDate(SEED_TODAY)} (exclusive)`);

  let weekIndex = 0;
  let dayCount = 0;
  for (let d = new Date(start); d < SEED_TODAY; d = addDays(d, 1)) {
    if (!isOpenDay(dow(d))) continue;
    if (dow(d) === 3) weekIndex++;

    const dateIso = isoDate(d);
    const rng = mulberry32(seedFromString(dateIso));
    const trend = 1 + weekIndex * 0.006;
    const noise = 0.92 + rng() * 0.16;
    const total = Math.round((WEEKDAY_BASE[dow(d)] ?? 150) * trend * noise);
    const intensity = WEEKDAY_INTENSITY[dow(d)] ?? 1;

    const split = splitBagels(total, flavorPcts);

    // Simulate per-flavor sold + sold-out.
    let totalSold = 0;
    let dayLastMin: number | null = null;
    const lines = split.map((s) => {
      const jitter = 0.85 + rng() * 0.4;
      const demand = s.qty * intensity * jitter;
      const sold = Math.min(s.qty, Math.round(demand));
      const soldOut = sold >= s.qty && demand > s.qty && s.qty > 0;
      let soldOutTime: string | null = null;
      if (soldOut) {
        const frac = Math.pow(rng() * 0.5 + 0.4, 1.3);
        const t = Math.round(openMin + frac * (closeMin - openMin));
        soldOutTime = hhmm(t);
        if (dayLastMin == null || t > dayLastMin) dayLastMin = t;
      }
      totalSold += sold;
      return { flavorId: s.flavorId, qtyBaked: s.qty, qtySold: sold, flavorSoldOut: soldOut, flavorSoldOutTime: soldOutTime };
    });

    const daySoldOut = totalSold >= total;
    const rec = await prisma.bakeRecord.create({
      data: {
        date: d,
        dayOfWeek: dow(d),
        retailOpenTime: OPEN_TIME,
        retailCloseTime: CLOSE_TIME,
        totalBaked: total,
        totalSold,
        soldOut: daySoldOut,
        soldOutTime: daySoldOut && dayLastMin != null ? hhmm(dayLastMin) : null,
      },
    });
    for (const l of lines) {
      await prisma.bakeRecordLine.create({ data: { bakeRecordId: rec.id, ...l } });
    }
    dayCount++;
  }
  console.log(`Created ${dayCount} bake records.`);

  // Draft plan for the upcoming week (total per day from the forecaster; flavors derive from %).
  const nextWeekWed = addDays(weekStartWednesday(SEED_TODAY), 7);
  console.log(`Seeding draft plan for week of ${isoDate(nextWeekWed)}…`);
  const plan = await prisma.weeklyPlan.create({
    data: { weekStartDate: nextWeekWed, status: "draft", rotatorName: "Jalapeño Cheddar", createdBy: "seed" },
  });
  for (const date of openWeekDates(nextWeekWed)) {
    const history = await loadWeekdayHistory(dow(date), 8);
    const fc = forecastWeekday(history, DEFAULT_CONFIG);
    const split = splitBagels(fc.recommendedTotal, flavorPcts);
    const planDay = await prisma.weeklyPlanDay.create({
      data: {
        weeklyPlanId: plan.id,
        date,
        dayOfWeek: dow(date),
        plannedTotal: fc.recommendedTotal,
        recommendedTotal: fc.recommendedTotal,
      },
    });
    for (const s of split) {
      await prisma.weeklyPlanDayLine.create({
        data: { weeklyPlanDayId: planDay.id, flavorId: s.flavorId, plannedQty: s.qty, recommendedQty: s.qty },
      });
    }
  }

  console.log("Seed complete.");
}

async function loadWeekdayHistory(targetDow: number, limit: number): Promise<DayRecordInput[]> {
  const records = await prisma.bakeRecord.findMany({
    where: { dayOfWeek: targetDow },
    orderBy: { date: "desc" },
    take: limit,
    include: { lines: true },
  });
  return records.map((r) => ({
    date: isoDate(r.date),
    baked: r.totalBaked,
    sold: r.totalSold,
    soldOut: r.soldOut,
    soldOutTime: r.soldOutTime,
    openTime: r.retailOpenTime,
    closeTime: r.retailCloseTime,
    flavors: r.lines.map((l) => ({
      flavorId: l.flavorId,
      baked: l.qtyBaked,
      sold: l.qtySold,
      soldOut: l.flavorSoldOut,
      soldOutTime: l.flavorSoldOutTime,
    })),
  }));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
