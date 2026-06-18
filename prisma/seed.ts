// Seed ~12 weeks of realistic Yard Sale Bagels history so the forecaster has signal.
// Patterns baked in: Thursdays run hot and sell out early (censored demand); Wednesdays
// linger with leftovers. Sales are generated through the same mock Square client the app
// uses, so seeded history matches what a live pull would produce.

import { PrismaClient } from "@prisma/client";
import { pullSoldForDate } from "../src/lib/square.ts";
import {
  OPEN_DOWS,
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

const prisma = new PrismaClient();

// "Today" the sample history is anchored to. Defaults to the real current date so the demo
// always looks current; APP_TODAY can pin it (used by tests / the original SQLite demo).
const SEED_TODAY = process.env.APP_TODAY ? parseIsoDate(process.env.APP_TODAY) : toUtcMidnight(new Date());
const WEEKS_BACK = 12;

const OPEN_TIME = "07:00";
const CLOSE_TIME = "11:00";

const FLAVORS = [
  { name: "Everything", share: 0.34, order: 1 },
  { name: "Asiago", share: 0.22, order: 2 },
  { name: "Plain", share: 0.19, order: 3 }, // placeholder (spec §3: 3 TBD) — edit in Settings
  { name: "Sesame", share: 0.15, order: 4 }, // placeholder
  { name: "Cinnamon Raisin", share: 0.1, order: 5 }, // placeholder
];

const FORMATS = [
  { name: "Single", bagelsPerUnit: 1, isSammie: false, order: 1 },
  { name: "6-Box", bagelsPerUnit: 6, isSammie: false, order: 2 },
  { name: "12-Box", bagelsPerUnit: 12, isSammie: false, order: 3 },
  { name: "Catering Box", bagelsPerUnit: 24, isSammie: false, order: 4 },
  { name: "Sammie", bagelsPerUnit: 1, isSammie: true, order: 5 },
];

// Base total baked per weekday (the operator's current "feel").
const WEEKDAY_BASE: Record<number, number> = { 3: 150, 4: 150, 5: 165, 6: 195, 0: 160 };

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

async function main() {
  // Idempotency guard: never wipe a database that already has data. This lets the seed run
  // safely on every deploy — it only populates sample data into a fresh, empty database.
  const existingFlavors = await prisma.flavor.count();
  if (existingFlavors > 0) {
    console.log(`Seed skipped — database already has ${existingFlavors} flavors (not overwriting real data).`);
    return;
  }

  console.log("Seeding sample data into empty database…");
  // Order matters for FK constraints.
  await prisma.weeklyPlanDayLine.deleteMany();
  await prisma.weeklyPlanDay.deleteMany();
  await prisma.weeklyPlan.deleteMany();
  await prisma.bakeRecordLine.deleteMany();
  await prisma.bakeRecord.deleteMany();
  await prisma.productMapping.deleteMany();
  await prisma.flavor.deleteMany();
  await prisma.format.deleteMany();
  await prisma.appSetting.deleteMany();

  console.log("Creating flavors, formats, settings…");
  const flavorRows = [];
  for (const f of FLAVORS) {
    flavorRows.push(await prisma.flavor.create({ data: { name: f.name, displayOrder: f.order, active: true } }));
  }
  for (const fmt of FORMATS) {
    await prisma.format.create({
      data: { name: fmt.name, bagelsPerUnit: fmt.bagelsPerUnit, isSammie: fmt.isSammie, displayOrder: fmt.order },
    });
  }

  // Example Square product mappings (Single of each flavor). Demonstrates §8 attribution.
  const single = await prisma.format.findFirst({ where: { name: "Single" } });
  for (const fr of flavorRows) {
    await prisma.productMapping.create({
      data: {
        squareVariationId: `var_${fr.name.toLowerCase().replace(/\s+/g, "_")}_single`,
        flavorId: fr.id,
        formatId: single!.id,
      },
    });
  }

  await prisma.appSetting.createMany({
    data: [
      { key: "retail_open_time", value: OPEN_TIME },
      { key: "retail_close_time", value: CLOSE_TIME },
      { key: "order_deadline_dow", value: "4" }, // Thursday
      { key: "order_alert_window_days", value: "3" },
      { key: "starter_buffer_pct", value: "10" },
      { key: "starter_hint_after_hour", value: "12" },
      { key: "service_level", value: String(DEFAULT_CONFIG.serviceLevel) },
      { key: "recency_decay", value: String(DEFAULT_CONFIG.recencyDecay) },
    ],
  });

  const flavorByName = new Map(flavorRows.map((f) => [f.name, f]));

  // Generate history for every open day in [start, SEED_TODAY).
  const start = addDays(weekStartWednesday(SEED_TODAY), -7 * WEEKS_BACK);
  console.log(`Generating bake history ${isoDate(start)} … ${isoDate(SEED_TODAY)} (exclusive)`);

  let weekIndex = 0;
  let dayCount = 0;
  for (let d = new Date(start); d < SEED_TODAY; d = addDays(d, 1)) {
    if (!isOpenDay(dow(d))) continue;
    if (dow(d) === 3) weekIndex++; // new open-week starts Wednesday

    const dateIso = isoDate(d);
    const rng = mulberry32(seedFromString(dateIso));
    // Gentle upward trend over the weeks + day noise.
    const trend = 1 + weekIndex * 0.006;
    const noise = 0.92 + rng() * 0.16; // 0.92..1.08
    const total = Math.round((WEEKDAY_BASE[dow(d)] ?? 150) * trend * noise);

    // Split total across flavors by share (largest-remainder so it sums exactly).
    const baked = splitByShare(total, FLAVORS.map((f) => ({ flavorId: flavorByName.get(f.name)!.id, share: f.share })));

    const sales = await pullSoldForDate(dateIso, baked, OPEN_TIME, CLOSE_TIME);
    const soldByFlavor = new Map(sales.lines.map((l) => [l.flavorId, l]));

    const totalBaked = baked.reduce((s, b) => s + b.baked, 0);
    const totalSold = sales.lines.reduce((s, l) => s + l.sold, 0);
    const daySoldOut = totalSold >= totalBaked;

    const rec = await prisma.bakeRecord.create({
      data: {
        date: d,
        dayOfWeek: dow(d),
        retailOpenTime: OPEN_TIME,
        retailCloseTime: CLOSE_TIME,
        totalBaked,
        totalSold,
        soldOut: daySoldOut,
        soldOutTime: daySoldOut ? sales.lastSaleTime : null,
        notes: null,
      },
    });

    for (const b of baked) {
      const line = soldByFlavor.get(b.flavorId)!;
      const flavorSoldOut = line.sold >= b.baked;
      await prisma.bakeRecordLine.create({
        data: {
          bakeRecordId: rec.id,
          flavorId: b.flavorId,
          qtyBaked: b.baked,
          qtySold: line.sold,
          flavorSoldOut,
          flavorSoldOutTime: flavorSoldOut ? line.lastSaleTime : null,
        },
      });
    }
    dayCount++;
  }
  console.log(`Created ${dayCount} bake records.`);

  // Seed a DRAFT plan for the upcoming open week (the Sysco cycle: plan next week now).
  const nextWeekWed = addDays(weekStartWednesday(SEED_TODAY), 7);
  console.log(`Seeding draft WeeklyPlan for week of ${isoDate(nextWeekWed)} from forecaster…`);
  await seedDraftPlan(nextWeekWed, flavorRows);

  console.log("Seed complete.");
}

interface ShareItem {
  flavorId: number;
  share: number;
}
function splitByShare(total: number, items: ShareItem[]): { flavorId: number; baked: number }[] {
  const raw = items.map((it) => ({ flavorId: it.flavorId, exact: total * it.share }));
  const floored = raw.map((r) => ({ ...r, base: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let leftover = total - floored.reduce((s, r) => s + r.base, 0);
  const order = [...floored].sort((a, b) => b.rem - a.rem);
  const bump = new Set<number>();
  for (let i = 0; i < leftover; i++) bump.add(order[i].flavorId);
  return floored.map((r) => ({ flavorId: r.flavorId, baked: r.base + (bump.has(r.flavorId) ? 1 : 0) }));
}

async function seedDraftPlan(weekWed: Date, flavorRows: { id: number; name: string }[]) {
  const plan = await prisma.weeklyPlan.create({
    data: { weekStartDate: weekWed, status: "draft", createdBy: "seed" },
  });

  for (const date of openWeekDates(weekWed)) {
    const targetDow = dow(date);
    const history = await loadWeekdayHistory(targetDow, 8);
    const fc = forecastWeekday(history, DEFAULT_CONFIG);

    const planDay = await prisma.weeklyPlanDay.create({
      data: {
        weeklyPlanId: plan.id,
        date,
        dayOfWeek: targetDow,
        plannedTotal: fc.recommendedTotal,
        recommendedTotal: fc.recommendedTotal,
      },
    });
    const byFlavor = new Map(fc.perFlavor.map((p) => [p.flavorId, p]));
    for (const fr of flavorRows) {
      const p = byFlavor.get(fr.id);
      await prisma.weeklyPlanDayLine.create({
        data: {
          weeklyPlanDayId: planDay.id,
          flavorId: fr.id,
          plannedQty: p?.recommendedQty ?? 0,
          recommendedQty: p?.recommendedQty ?? 0,
        },
      });
    }
  }
}

// Mirrors the app's query helper, but local to the seed to avoid importing server code.
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

// Keep imports honest under noUnusedLocals-style linting.
void OPEN_DOWS;
