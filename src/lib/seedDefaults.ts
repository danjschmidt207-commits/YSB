// Shared default-data helpers, used by both prisma/seed.ts and the in-app "reset to defaults"
// action. Accepts any PrismaClient so it works from the seed script and the Next runtime.

import { DEFAULT_FLAVORS, defaultSettingRows } from "./config";

type Db = {
  flavor: any;
  format: any;
  appSetting: any;
  productMapping: any;
  ingredient: any;
};

export const DEFAULT_FORMATS = [
  { name: "Single", bagelsPerUnit: 1, isSammie: false, order: 1 },
  { name: "6-Box", bagelsPerUnit: 6, isSammie: false, order: 2 },
  { name: "12-Box", bagelsPerUnit: 12, isSammie: false, order: 3 },
  { name: "Catering Box", bagelsPerUnit: 24, isSammie: false, order: 4 },
  { name: "Sammie", bagelsPerUnit: 1, isSammie: true, order: 5 },
];

// Ingredients the recipes consume. Names MUST match recipe component names (case-insensitive)
// so the Order page can net weekly demand against on-hand stock. Costs/packs are editable estimates.
export const DEFAULT_INGREDIENTS = [
  // Dough
  { name: "Flour", category: "dough", unit: "lb", packSize: 50, costPerUnit: 0.5, parLevel: 150, reorderPoint: 60, supplier: "sysco" },
  { name: "Honey", category: "dough", unit: "lb", packSize: 5, costPerUnit: 4, parLevel: 20, reorderPoint: 8, supplier: "sysco" },
  { name: "Salt", category: "dough", unit: "lb", packSize: 5, costPerUnit: 1, parLevel: 12, reorderPoint: 5, supplier: "sysco" },
  // Spread / schmear base
  { name: "Cream cheese", category: "spread", unit: "lb", packSize: 30, costPerUnit: 3, parLevel: 120, reorderPoint: 60, supplier: "sysco" },
  { name: "Lemon juice", category: "spread", unit: "g", packSize: 1000, costPerUnit: 0.004, parLevel: 2000, reorderPoint: 1000, supplier: "sysco" },
  // Schmear mix-ins
  { name: "Bacon", category: "sammy", unit: "lb", packSize: 15, costPerUnit: 6, parLevel: 15, reorderPoint: 6, supplier: "sysco" },
  { name: "Scallion", category: "topping", unit: "lb", packSize: 2, costPerUnit: 4, parLevel: 4, reorderPoint: 2, supplier: "sysco" },
  { name: "Chives", category: "topping", unit: "lb", packSize: 1, costPerUnit: 12, parLevel: 2, reorderPoint: 1, supplier: "sysco" },
  { name: "Dill", category: "topping", unit: "lb", packSize: 1, costPerUnit: 14, parLevel: 1.5, reorderPoint: 0.5, supplier: "sysco" },
  { name: "Sage", category: "topping", unit: "lb", packSize: 1, costPerUnit: 14, parLevel: 1, reorderPoint: 0.3, supplier: "sysco" },
  { name: "Basil", category: "topping", unit: "lb", packSize: 1, costPerUnit: 12, parLevel: 1, reorderPoint: 0.5, supplier: "sysco" },
  { name: "Lox", category: "spread", unit: "lb", packSize: 3, costPerUnit: 18, parLevel: 6, reorderPoint: 3, supplier: "sysco" },
  { name: "Garlic powder", category: "topping", unit: "g", packSize: 500, costPerUnit: 0.01, parLevel: 500, reorderPoint: 200, supplier: "sysco" },
  { name: "Pepper", category: "topping", unit: "g", packSize: 500, costPerUnit: 0.02, parLevel: 500, reorderPoint: 200, supplier: "sysco" },
  // Toppings (bagel)
  { name: "Everything seasoning", category: "topping", unit: "lb", packSize: 5, costPerUnit: 6, parLevel: 10, reorderPoint: 4, supplier: "house" },
  { name: "Asiago cheese", category: "topping", unit: "lb", packSize: 5, costPerUnit: 7, parLevel: 8, reorderPoint: 4, supplier: "sysco" },
  // Packaging (inventory only — no weight demand)
  { name: "6-pack box", category: "packaging", unit: "ea", packSize: 100, costPerUnit: 0.4, parLevel: 300, reorderPoint: 150, supplier: "sysco" },
  { name: "12-pack box", category: "packaging", unit: "ea", packSize: 100, costPerUnit: 0.55, parLevel: 200, reorderPoint: 100, supplier: "sysco" },
  { name: "Catering box", category: "packaging", unit: "ea", packSize: 50, costPerUnit: 1.2, parLevel: 100, reorderPoint: 50, supplier: "sysco" },
  { name: "Bags", category: "packaging", unit: "ea", packSize: 500, costPerUnit: 0.05, parLevel: 1000, reorderPoint: 500, supplier: "sysco" },
];

/** Create-or-update the flavor set, formats, ingredients, and settings to the current defaults. */
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
  for (const ing of DEFAULT_INGREDIENTS) {
    // On update we keep the operator's counted currentStock; only refresh config fields.
    await db.ingredient.upsert({
      where: { name: ing.name } as any,
      update: { category: ing.category, unit: ing.unit, packSize: ing.packSize, costPerUnit: ing.costPerUnit, parLevel: ing.parLevel, reorderPoint: ing.reorderPoint, supplier: ing.supplier },
      create: { ...ing, currentStock: 0 },
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
