"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseIsoDate, dow, openWeekDates, isoDate } from "@/lib/dates";
import { pullSoldForDate } from "@/lib/square";
import { forecastWeekday } from "@/lib/forecast";
import { getSettings } from "@/lib/settings";
import { loadWeekdayHistory } from "@/lib/queries";

/** BAKE-1/-5/-6: create or update a day's bake entry (per-flavor baked, hours, notes). */
export async function saveBake(input: {
  dateIso: string;
  openTime?: string;
  closeTime?: string;
  notes?: string;
  lines: { flavorId: number; baked: number }[];
}) {
  const date = parseIsoDate(input.dateIso);
  const totalBaked = input.lines.reduce((s, l) => s + (l.baked || 0), 0);

  const existing = await prisma.bakeRecord.findUnique({ where: { date }, include: { lines: true } });

  if (!existing) {
    await prisma.bakeRecord.create({
      data: {
        date,
        dayOfWeek: dow(date),
        retailOpenTime: input.openTime || null,
        retailCloseTime: input.closeTime || null,
        notes: input.notes || null,
        totalBaked,
        totalSold: 0,
        lines: {
          create: input.lines.map((l) => ({ flavorId: l.flavorId, qtyBaked: l.baked || 0 })),
        },
      },
    });
  } else {
    await prisma.bakeRecord.update({
      where: { date },
      data: {
        retailOpenTime: input.openTime || null,
        retailCloseTime: input.closeTime || null,
        notes: input.notes ?? existing.notes,
        totalBaked,
      },
    });
    for (const l of input.lines) {
      await prisma.bakeRecordLine.upsert({
        where: { bakeRecordId_flavorId: { bakeRecordId: existing.id, flavorId: l.flavorId } },
        update: { qtyBaked: l.baked || 0 },
        create: { bakeRecordId: existing.id, flavorId: l.flavorId, qtyBaked: l.baked || 0 },
      });
    }
    await recomputeSoldOut(existing.id);
  }

  revalidatePath("/");
  revalidatePath("/bake");
  revalidatePath(`/bake/${input.dateIso}`);
}

/** BAKE-2/INT-2: pull sold quantities from Square (mock in Phase 1) and attribute per flavor. */
export async function refreshSales(dateIso: string) {
  const date = parseIsoDate(dateIso);
  const rec = await prisma.bakeRecord.findUnique({ where: { date }, include: { lines: true } });
  if (!rec) return { ok: false, message: "No bake record for that date yet." };

  const baked = rec.lines.map((l) => ({ flavorId: l.flavorId, baked: l.qtyBaked }));
  const sales = await pullSoldForDate(dateIso, baked, rec.retailOpenTime ?? "07:00", rec.retailCloseTime ?? "11:00");
  const byFlavor = new Map(sales.lines.map((l) => [l.flavorId, l]));

  for (const l of rec.lines) {
    const s = byFlavor.get(l.flavorId);
    if (!s) continue;
    const soldOut = s.sold >= l.qtyBaked && l.qtyBaked > 0;
    await prisma.bakeRecordLine.update({
      where: { id: l.id },
      data: {
        qtySold: s.sold,
        // BAKE-3: auto-detect sold-out; keep a manually-set time if one already exists.
        flavorSoldOut: soldOut,
        flavorSoldOutTime: soldOut ? l.flavorSoldOutTime ?? s.lastSaleTime : null,
      },
    });
  }
  await recomputeSoldOut(rec.id);

  revalidatePath("/");
  revalidatePath(`/bake/${dateIso}`);
  return { ok: true, message: `Pulled sales from ${sales.source === "mock" ? "Square (mock)" : "Square"}.` };
}

/** BAKE-3: manual sold-out override for a flavor line. */
export async function setFlavorSoldOut(lineId: number, soldOut: boolean, time?: string) {
  const line = await prisma.bakeRecordLine.update({
    where: { id: lineId },
    data: { flavorSoldOut: soldOut, flavorSoldOutTime: soldOut ? time || null : null },
    include: { bakeRecord: true },
  });
  await recomputeSoldOut(line.bakeRecordId);
  revalidatePath(`/bake/${isoDate(line.bakeRecord.date)}`);
}

/** BAKE-3: manual sold-out override for the whole day. */
export async function setDaySoldOut(dateIso: string, soldOut: boolean, time?: string) {
  const date = parseIsoDate(dateIso);
  await prisma.bakeRecord.update({
    where: { date },
    data: { soldOut, soldOutTime: soldOut ? time || null : null },
  });
  revalidatePath("/");
  revalidatePath(`/bake/${dateIso}`);
}

/** Recompute day totals + auto-detected sold-out from the flavor lines (BAKE-3/-4). */
async function recomputeSoldOut(bakeRecordId: number) {
  const rec = await prisma.bakeRecord.findUnique({ where: { id: bakeRecordId }, include: { lines: true } });
  if (!rec) return;
  const totalBaked = rec.lines.reduce((s, l) => s + l.qtyBaked, 0);
  const totalSold = rec.lines.reduce((s, l) => s + l.qtySold, 0);
  const allFlavorsSoldOut = rec.lines.length > 0 && rec.lines.every((l) => l.flavorSoldOut);
  const daySoldOut = rec.soldOut || allFlavorsSoldOut || (totalBaked > 0 && totalSold >= totalBaked);
  // Day sold-out time = the latest flavor sell-out time (the day isn't "out" until the last flavor is).
  const times = rec.lines.filter((l) => l.flavorSoldOut && l.flavorSoldOutTime).map((l) => l.flavorSoldOutTime!);
  const latest = times.length ? times.sort().at(-1)! : rec.soldOutTime;
  await prisma.bakeRecord.update({
    where: { id: bakeRecordId },
    data: {
      totalBaked,
      totalSold,
      soldOut: daySoldOut,
      soldOutTime: daySoldOut ? latest : null,
    },
  });
}

/** PLN-2/-3/-5: build (or rebuild) a DRAFT plan for an open week from the forecaster. */
export async function generatePlan(weekStartIso: string) {
  const weekWed = parseIsoDate(weekStartIso);
  const settings = await getSettings();
  const flavors = await prisma.flavor.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } });

  const existing = await prisma.weeklyPlan.findUnique({ where: { weekStartDate: weekWed } });
  if (existing && existing.status === "ordered") {
    return { ok: false, message: "This week is already ordered and can't be regenerated." };
  }
  if (existing) {
    await prisma.weeklyPlan.delete({ where: { id: existing.id } }); // cascade days/lines
  }

  const plan = await prisma.weeklyPlan.create({
    data: { weekStartDate: weekWed, status: "draft", createdBy: "app" },
  });

  for (const date of openWeekDates(weekWed)) {
    const targetDow = dow(date);
    const history = await loadWeekdayHistory(targetDow, 8);
    const fc = forecastWeekday(history, settings.forecast);
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
    for (const f of flavors) {
      const p = byFlavor.get(f.id);
      await prisma.weeklyPlanDayLine.create({
        data: {
          weeklyPlanDayId: planDay.id,
          flavorId: f.id,
          plannedQty: p?.recommendedQty ?? 0,
          recommendedQty: p?.recommendedQty ?? 0,
        },
      });
    }
  }
  revalidatePath("/plan");
  revalidatePath("/");
  return { ok: true, message: "Draft plan generated from the forecaster." };
}

/** PLN-4: override planned per-flavor quantities for one day; total re-sums. */
export async function savePlanDay(planDayId: number, lines: { flavorId: number; planned: number }[]) {
  for (const l of lines) {
    await prisma.weeklyPlanDayLine.updateMany({
      where: { weeklyPlanDayId: planDayId, flavorId: l.flavorId },
      data: { plannedQty: Math.max(0, l.planned || 0) },
    });
  }
  const total = lines.reduce((s, l) => s + Math.max(0, l.planned || 0), 0);
  await prisma.weeklyPlanDay.update({ where: { id: planDayId }, data: { plannedTotal: total } });
  revalidatePath("/plan");
}

/** PLN-5: lock / unlock a week. Locking feeds the (future) recipe + ordering modules. */
export async function setPlanStatus(planId: number, status: "draft" | "locked" | "ordered") {
  await prisma.weeklyPlan.update({ where: { id: planId }, data: { status } });
  revalidatePath("/plan");
  revalidatePath("/");
}

/** CFG: rename / activate a flavor (spec §3 — fill in the 3 TBD flavors here). */
export async function updateFlavor(id: number, name: string, active: boolean) {
  await prisma.flavor.update({ where: { id }, data: { name: name.trim() || undefined, active } });
  revalidatePath("/settings");
  revalidatePath("/bake");
  revalidatePath("/plan");
}

/** CFG: update a single app setting (e.g. service level, hours, buffer). */
export async function updateSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/plan");
}
