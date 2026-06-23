"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseIsoDate, dow, openWeekDates, isoDate } from "@/lib/dates";
import { forecastWeekday } from "@/lib/forecast";
import { getSettings } from "@/lib/settings";
import { loadWeekdayHistory } from "@/lib/queries";
import { splitBagels, type FlavorPct } from "@/lib/calc";
import { applyDefaults, clearTransactional } from "@/lib/seedDefaults";
import { DEFAULT_FLAVORS } from "@/lib/config";
import { getConfig } from "@/lib/serverConfig";
import { fetchSquareSales } from "@/lib/square";
import { buildContext, attributeModifier, IGNORE } from "@/lib/attribute";

/** Round shares (summing ~1) to integer percentages that total exactly 100 (largest remainder). */
function toPct100(shares: { id: number | string; share: number }[]): Map<number | string, number> {
  const raw = shares.map((s) => ({ id: s.id, exact: s.share * 100 }));
  const floored = raw.map((r) => ({ id: r.id, base: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let leftover = 100 - floored.reduce((s, r) => s + r.base, 0);
  const order = [...floored].sort((a, b) => b.rem - a.rem);
  const bump = new Set<number | string>();
  for (let i = 0; i < leftover && i < order.length; i++) bump.add(order[i].id);
  return new Map(floored.map((r) => [r.id, r.base + (bump.has(r.id) ? 1 : 0)]));
}

async function flavorPcts(): Promise<FlavorPct[]> {
  const flavors = await prisma.flavor.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } });
  return flavors.map((f) => ({ flavorId: f.id, name: f.name, pct: f.pct }));
}

/**
 * BAKE: create/update a day's record from manual entry. Per flavor we store baked + leftover
 * (sold = baked − leftover). Works for any date, so history can be back-filled.
 */
export async function saveBake(input: {
  dateIso: string;
  openTime?: string;
  closeTime?: string;
  notes?: string;
  soldOut?: boolean;
  soldOutTime?: string;
  lines: { flavorId: number; baked: number; leftover: number }[];
}) {
  const date = parseIsoDate(input.dateIso);

  const computed = input.lines.map((l) => {
    const baked = Math.max(0, l.baked || 0);
    const leftover = Math.max(0, Math.min(baked, l.leftover || 0));
    const sold = baked - leftover;
    const flavorSoldOut = baked > 0 && leftover === 0;
    return { flavorId: l.flavorId, qtyBaked: baked, qtySold: sold, flavorSoldOut };
  });
  const totalBaked = computed.reduce((s, l) => s + l.qtyBaked, 0);
  const totalSold = computed.reduce((s, l) => s + l.qtySold, 0);
  const daySoldOut = input.soldOut ?? (totalBaked > 0 && totalSold >= totalBaked);
  const soldOutTime = daySoldOut ? input.soldOutTime || null : null;

  const rec = await prisma.bakeRecord.upsert({
    where: { date },
    update: {
      retailOpenTime: input.openTime || null,
      retailCloseTime: input.closeTime || null,
      notes: input.notes || null,
      totalBaked,
      totalSold,
      soldOut: daySoldOut,
      soldOutTime,
    },
    create: {
      date,
      dayOfWeek: dow(date),
      retailOpenTime: input.openTime || null,
      retailCloseTime: input.closeTime || null,
      notes: input.notes || null,
      totalBaked,
      totalSold,
      soldOut: daySoldOut,
      soldOutTime,
    },
  });

  for (const l of computed) {
    await prisma.bakeRecordLine.upsert({
      where: { bakeRecordId_flavorId: { bakeRecordId: rec.id, flavorId: l.flavorId } },
      update: {
        qtyBaked: l.qtyBaked,
        qtySold: l.qtySold,
        flavorSoldOut: l.flavorSoldOut,
        flavorSoldOutTime: l.flavorSoldOut ? soldOutTime : null,
      },
      create: {
        bakeRecordId: rec.id,
        flavorId: l.flavorId,
        qtyBaked: l.qtyBaked,
        qtySold: l.qtySold,
        flavorSoldOut: l.flavorSoldOut,
        flavorSoldOutTime: l.flavorSoldOut ? soldOutTime : null,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/bake");
  revalidatePath(`/bake/${input.dateIso}`);
  return { ok: true };
}

/** PLN: build/rebuild a DRAFT plan for an open week. Total per day from the forecaster; flavors derive from %. */
export async function generatePlan(weekStartIso: string, rotatorName?: string) {
  const weekWed = parseIsoDate(weekStartIso);
  const settings = await getSettings();
  const pcts = await flavorPcts();

  const existing = await prisma.weeklyPlan.findUnique({ where: { weekStartDate: weekWed } });
  if (existing && existing.status === "ordered") {
    return { ok: false, message: "This week is already ordered and can't be regenerated." };
  }
  const keepRotator = rotatorName ?? existing?.rotatorName ?? null;
  if (existing) await prisma.weeklyPlan.delete({ where: { id: existing.id } });

  const plan = await prisma.weeklyPlan.create({
    data: { weekStartDate: weekWed, status: "draft", rotatorName: keepRotator, createdBy: "app" },
  });

  for (const date of openWeekDates(weekWed)) {
    const history = await loadWeekdayHistory(dow(date), 8);
    const fc = forecastWeekday(history, settings.forecast);
    const planDay = await prisma.weeklyPlanDay.create({
      data: {
        weeklyPlanId: plan.id,
        date,
        dayOfWeek: dow(date),
        plannedTotal: fc.recommendedTotal,
        recommendedTotal: fc.recommendedTotal,
      },
    });
    for (const s of splitBagels(fc.recommendedTotal, pcts)) {
      await prisma.weeklyPlanDayLine.create({
        data: { weeklyPlanDayId: planDay.id, flavorId: s.flavorId, plannedQty: s.qty, recommendedQty: s.qty },
      });
    }
  }
  revalidatePath("/plan");
  revalidatePath("/prep");
  revalidatePath("/");
  return { ok: true, message: "Draft plan generated." };
}

/** PLN: set a day's planned TOTAL; per-flavor split is recomputed from percentages. */
export async function savePlanDayTotal(planDayId: number, total: number) {
  const t = Math.max(0, total || 0);
  const pcts = await flavorPcts();
  await prisma.weeklyPlanDay.update({ where: { id: planDayId }, data: { plannedTotal: t } });
  const split = splitBagels(t, pcts);
  const byFlavor = new Map(split.map((s) => [s.flavorId, s.qty]));
  for (const [flavorId, qty] of byFlavor) {
    await prisma.weeklyPlanDayLine.updateMany({
      where: { weeklyPlanDayId: planDayId, flavorId },
      data: { plannedQty: qty },
    });
  }
  revalidatePath("/plan");
  revalidatePath("/prep");
}

/** PLN: name this week's rotator flavor. */
export async function setRotatorName(planId: number, name: string) {
  await prisma.weeklyPlan.update({ where: { id: planId }, data: { rotatorName: name.trim() || null } });
  revalidatePath("/plan");
  revalidatePath("/prep");
}

/** PLN: lock / unlock a week (locked feeds the prep calculators). */
export async function setPlanStatus(planId: number, status: "draft" | "locked" | "ordered") {
  await prisma.weeklyPlan.update({ where: { id: planId }, data: { status } });
  revalidatePath("/plan");
  revalidatePath("/prep");
  revalidatePath("/");
}

/** CFG: rename / activate a flavor. */
export async function updateFlavor(id: number, name: string, active: boolean) {
  await prisma.flavor.update({ where: { id }, data: { name: name.trim() || undefined, active } });
  revalidatePath("/settings");
  revalidatePath("/bake");
  revalidatePath("/plan");
}

/** CFG: set a flavor's default percentage of the daily bake. */
export async function updateFlavorPct(id: number, pct: number) {
  await prisma.flavor.update({ where: { id }, data: { pct: Math.max(0, pct || 0) } });
  revalidatePath("/settings");
  revalidatePath("/plan");
  revalidatePath("/prep");
}

/** CFG: update a single app setting (raw string/JSON value). */
export async function updateSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/prep");
}

/** INV: update an ingredient's stock count and ordering fields. */
export async function updateIngredient(
  id: number,
  data: { currentStock?: number; parLevel?: number; reorderPoint?: number; costPerUnit?: number; packSize?: number; supplier?: string }
) {
  const clean: Record<string, number | string> = {};
  if (data.currentStock != null) clean.currentStock = Math.max(0, data.currentStock);
  if (data.parLevel != null) clean.parLevel = Math.max(0, data.parLevel);
  if (data.reorderPoint != null) clean.reorderPoint = Math.max(0, data.reorderPoint);
  if (data.costPerUnit != null) clean.costPerUnit = Math.max(0, data.costPerUnit);
  if (data.packSize != null) clean.packSize = Math.max(0, data.packSize);
  if (data.supplier) clean.supplier = data.supplier;
  await prisma.ingredient.update({ where: { id }, data: clean });
  revalidatePath("/inventory");
  revalidatePath("/order");
}

/** SQUARE: import completed sales for a date range and attribute each line to a flavor/schmear. */
export async function importSquareSales(fromIso: string, toIso: string) {
  const { source, lines, diag } = await fetchSquareSales(fromIso, toIso);
  const [flavors, config, overrideRow] = await Promise.all([
    prisma.flavor.findMany({ where: { active: true } }),
    getConfig(),
    prisma.appSetting.findUnique({ where: { key: "square_overrides" } }),
  ]);
  const overrides = overrideRow ? (JSON.parse(overrideRow.value) as Record<string, number | string>) : {};
  const ctx = buildContext(
    flavors.map((f) => ({ id: f.id, name: f.name })),
    config.schmear.types.map((t) => ({ key: t.key, name: t.name })),
    overrides
  );

  // Replace any prior import of this date range (fixes older/buggy rows on re-import).
  await prisma.squareSale.deleteMany({
    where: { date: { gte: parseIsoDate(fromIso), lte: parseIsoDate(toIso) } },
  });

  const unmapped = new Set<string>();
  let imported = 0;
  for (const line of lines) {
    const att = attributeModifier(line.modifier, ctx);
    if (!att.mapped) {
      unmapped.add(line.modifier);
      continue;
    }
    // Resolved-but-ignored (e.g. "None", coffee add-ons): don't store.
    if (att.flavorId == null && att.schmearKey == null) continue;
    const date = parseIsoDate(line.soldAt.slice(0, 10));
    await prisma.squareSale.upsert({
      where: { uid: line.uid },
      update: { flavorId: att.flavorId, schmearKey: att.schmearKey, qty: line.qty },
      create: {
        uid: line.uid,
        soldAt: new Date(line.soldAt),
        date,
        dayOfWeek: dow(date),
        flavorId: att.flavorId,
        schmearKey: att.schmearKey,
        itemName: line.itemName,
        qty: line.qty,
      },
    });
    imported += line.qty;
  }

  await prisma.appSetting.upsert({
    where: { key: "square_unmapped" },
    update: { value: JSON.stringify([...unmapped]) },
    create: { key: "square_unmapped", value: JSON.stringify([...unmapped]) },
  });

  // Persist the structural diagnostic so it can be inspected in Settings.
  const rows = lines.length;
  await prisma.appSetting.upsert({
    where: { key: "square_diag" },
    update: { value: JSON.stringify({ ...diag, rows, imported }) },
    create: { key: "square_diag", value: JSON.stringify({ ...diag, rows, imported }) },
  });

  revalidatePath("/insights");
  revalidatePath("/settings");
  return { ok: true, source, imported, unmapped: [...unmapped], diag };
}

/**
 * SQUARE: map an unmatched modifier to a target, applied on re-import. Value is a flavorId
 * (number), a "schmear:<key>" string, or "ignore".
 */
export async function setSquareOverride(name: string, value: number | string) {
  await mergeOverrides({ [name]: value === "ignore" ? IGNORE : value });
  revalidatePath("/settings");
}

/** SQUARE: ignore a batch of modifiers in one go (e.g. the coffee options). */
export async function ignoreSquareModifiers(names: string[]) {
  const patch: Record<string, string> = {};
  for (const n of names) patch[n] = IGNORE;
  await mergeOverrides(patch);
  revalidatePath("/settings");
}

async function mergeOverrides(patch: Record<string, number | string>) {
  const row = await prisma.appSetting.findUnique({ where: { key: "square_overrides" } });
  const map = row ? (JSON.parse(row.value) as Record<string, number | string>) : {};
  Object.assign(map, patch);
  await prisma.appSetting.upsert({
    where: { key: "square_overrides" },
    update: { value: JSON.stringify(map) },
    create: { key: "square_overrides", value: JSON.stringify(map) },
  });
}

/** INSIGHTS: set each flavor's % from the imported Square flavor mix. */
export async function applyFlavorMixFromSquare() {
  const grouped = await prisma.squareSale.groupBy({
    by: ["flavorId"],
    where: { flavorId: { not: null } },
    _sum: { qty: true },
  });
  const total = grouped.reduce((s, g) => s + (g._sum.qty ?? 0), 0);
  if (total === 0) return { ok: false, message: "No attributed Square sales yet." };
  const pcts = toPct100(grouped.map((g) => ({ id: g.flavorId as number, share: (g._sum.qty ?? 0) / total })));
  for (const [flavorId, pct] of pcts) {
    await prisma.flavor.update({ where: { id: flavorId as number }, data: { pct } });
  }
  revalidatePath("/settings");
  revalidatePath("/plan");
  revalidatePath("/prep");
  revalidatePath("/insights");
  return { ok: true };
}

/** INSIGHTS: set each schmear type's % from the imported Square schmear mix. */
export async function applySchmearMixFromSquare() {
  const config = await getConfig();
  const grouped = await prisma.squareSale.groupBy({
    by: ["schmearKey"],
    where: { schmearKey: { not: null } },
    _sum: { qty: true },
  });
  const total = grouped.reduce((s, g) => s + (g._sum.qty ?? 0), 0);
  if (total === 0) return { ok: false, message: "No attributed schmear sales yet." };
  const pcts = toPct100(grouped.map((g) => ({ id: g.schmearKey as string, share: (g._sum.qty ?? 0) / total })));
  const types = config.schmear.types.map((t) => ({ ...t, pct: pcts.get(t.key) ?? 0 }));
  await prisma.appSetting.upsert({
    where: { key: "schmear_config" },
    update: { value: JSON.stringify({ ...config.schmear, types }) },
    create: { key: "schmear_config", value: JSON.stringify({ ...config.schmear, types }) },
  });
  revalidatePath("/settings");
  revalidatePath("/prep");
  revalidatePath("/insights");
  return { ok: true };
}

/** CFG: clear bake history + plans, keep configuration. */
export async function clearSampleData() {
  const removed = await prisma.bakeRecord.count();
  await clearTransactional(prisma);
  revalidatePath("/");
  revalidatePath("/bake");
  revalidatePath("/plan");
  revalidatePath("/prep");
  return { removed };
}

/**
 * CFG: reset flavors, formats, and settings to the current app defaults (4 permanent + rotator,
 * 8–13 hours, dough/starter/schmear recipes). Also clears bake history + plans. Use this once to
 * migrate an older database to the new model.
 */
export async function resetToDefaults() {
  await clearTransactional(prisma);
  // Drop legacy Square product mappings (unused now) so old flavors can be removed.
  await prisma.productMapping.deleteMany();
  // Remove flavors that aren't part of the default set (now safe — nothing references them).
  const keep = DEFAULT_FLAVORS.map((f) => f.name);
  await prisma.flavor.deleteMany({ where: { name: { notIn: keep } } });
  await applyDefaults(prisma);
  revalidatePath("/");
  revalidatePath("/bake");
  revalidatePath("/plan");
  revalidatePath("/prep");
  revalidatePath("/settings");
  return { ok: true };
}
