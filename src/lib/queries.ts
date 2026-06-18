import { prisma } from "./db";
import { isoDate } from "./dates";
import type { DayRecordInput } from "./forecast";

export async function getActiveFlavors() {
  return prisma.flavor.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } });
}

export async function getBakeRecord(date: Date) {
  return prisma.bakeRecord.findUnique({
    where: { date },
    include: { lines: { include: { flavor: true } } },
  });
}

/** Trailing same-weekday history shaped for the forecaster. */
export async function loadWeekdayHistory(targetDow: number, limit = 8): Promise<DayRecordInput[]> {
  const records = await prisma.bakeRecord.findMany({
    where: { dayOfWeek: targetDow },
    orderBy: { date: "desc" },
    take: limit,
    include: { lines: true },
  });
  return records.map(toDayRecordInput);
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

export async function getPlanForWeek(weekStartDate: Date) {
  return prisma.weeklyPlan.findUnique({
    where: { weekStartDate },
    include: { days: { include: { lines: { include: { flavor: true } } }, orderBy: { date: "asc" } } },
  });
}
