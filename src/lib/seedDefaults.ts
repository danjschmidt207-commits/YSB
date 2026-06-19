// Shared default-data helpers, used by both prisma/seed.ts and the in-app "reset to defaults"
// action. Accepts any PrismaClient so it works from the seed script and the Next runtime.

import { DEFAULT_FLAVORS, defaultSettingRows } from "./config";

type Db = {
  flavor: any;
  format: any;
  appSetting: any;
  productMapping: any;
};

export const DEFAULT_FORMATS = [
  { name: "Single", bagelsPerUnit: 1, isSammie: false, order: 1 },
  { name: "6-Box", bagelsPerUnit: 6, isSammie: false, order: 2 },
  { name: "12-Box", bagelsPerUnit: 12, isSammie: false, order: 3 },
  { name: "Catering Box", bagelsPerUnit: 24, isSammie: false, order: 4 },
  { name: "Sammie", bagelsPerUnit: 1, isSammie: true, order: 5 },
];

/** Create-or-update the flavor set, formats, and settings to the current defaults. */
export async function applyDefaults(db: Db) {
  for (const f of DEFAULT_FLAVORS) {
    await db.flavor.upsert({
      where: { name: f.name },
      update: { pct: f.pct, isRotator: f.isRotator, displayOrder: f.order, active: true },
      create: { name: f.name, pct: f.pct, isRotator: f.isRotator, displayOrder: f.order, active: true },
    });
  }
  for (const fmt of DEFAULT_FORMATS) {
    await db.format.upsert({
      where: { name: fmt.name },
      update: { bagelsPerUnit: fmt.bagelsPerUnit, isSammie: fmt.isSammie, displayOrder: fmt.order },
      create: { name: fmt.name, bagelsPerUnit: fmt.bagelsPerUnit, isSammie: fmt.isSammie, displayOrder: fmt.order },
    });
  }
  for (const row of defaultSettingRows()) {
    await db.appSetting.upsert({ where: { key: row.key }, update: { value: row.value }, create: row });
  }
}

/** Delete all transactional data (bake history + plans + starter logs). Keeps config. */
export async function clearTransactional(db: any) {
  await db.weeklyPlanDayLine.deleteMany();
  await db.weeklyPlanDay.deleteMany();
  await db.weeklyPlan.deleteMany();
  await db.bakeRecordLine.deleteMany();
  await db.bakeRecord.deleteMany();
  await db.starterLog.deleteMany();
}
