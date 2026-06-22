// Yard Sale Bagels — configuration & recipe defaults (PURE: no DB imports, safe in client code).
// Defaults live here; AppSetting rows can override them. The DB loader getConfig() lives in
// serverConfig.ts so this module stays importable from client components.

export const LB = 453.59237; // grams per pound
export const OZ = 28.349523; // grams per ounce

/** Dough recipe as parts (a ratio). flour:starter:water:honey:salt. bagelWeightG = dough per bagel. */
export interface DoughRecipe {
  flour: number;
  starter: number;
  water: number;
  honey: number;
  salt: number;
  bagelWeightG: number;
}

export const DEFAULT_DOUGH: DoughRecipe = {
  flour: 90,
  starter: 18,
  water: 50,
  honey: 7,
  salt: 1.83,
  bagelWeightG: 160,
};

/** Sourdough starter feeding. seed:flour:water ratio, buffer, and how many nights before bake. */
export interface StarterConfig {
  seed: number;
  flour: number;
  water: number;
  bufferPct: number;
  leadNights: number; // fed this many nights before the bake day (default 2)
}

export const DEFAULT_STARTER: StarterConfig = {
  seed: 1,
  flour: 10,
  water: 10,
  bufferPct: 10,
  leadNights: 2,
};

export interface SchmearComponent {
  name: string;
  grams: number;
}
export interface SchmearType {
  key: string;
  name: string;
  pct: number; // share of the week's total schmear
  components: SchmearComponent[]; // base recipe (one batch)
}
export interface SchmearConfig {
  servingOz: number; // schmear per bagel
  types: SchmearType[];
}

// Base schmear recipes (from the owner's sheet), weights normalized to grams.
export const DEFAULT_SCHMEAR: SchmearConfig = {
  servingOz: 1.5,
  types: [
    {
      key: "plain",
      name: "Plain",
      pct: 40,
      // Plain = straight cream cheese (assumption — edit in Settings).
      components: [{ name: "Cream cheese", grams: 36 * LB }],
    },
    {
      key: "bacon_scallion",
      name: "Bacon & Scallion",
      pct: 20,
      components: [
        { name: "Cream cheese", grams: 36 * LB },
        { name: "Bacon", grams: 5 * LB },
        { name: "Scallion", grams: 2 * LB },
        { name: "Lemon juice", grams: 200 },
        { name: "Salt", grams: 60 },
        { name: "Pepper", grams: 10 },
        { name: "Garlic powder", grams: 10 },
      ],
    },
    {
      key: "chive_herb",
      name: "Chive & Herb",
      pct: 20,
      components: [
        { name: "Cream cheese", grams: 36 * LB },
        { name: "Chives", grams: 2 * LB },
        { name: "Dill", grams: (1 / 3) * LB },
        { name: "Sage", grams: 0.14 * LB },
        { name: "Basil", grams: (1 / 3) * LB },
        { name: "Salt", grams: 60 },
        { name: "Pepper", grams: 10 },
      ],
    },
    {
      key: "lox_dill",
      name: "Lox & Dill",
      pct: 20,
      components: [
        { name: "Cream cheese", grams: 36 * LB },
        { name: "Lox", grams: 3 * LB },
        { name: "Lemon juice", grams: 200 },
        { name: "Dill", grams: 0.5 * LB },
        { name: "Salt", grams: 60 },
        { name: "Pepper", grams: 10 },
      ],
    },
    {
      key: "butter",
      name: "Butter",
      pct: 0,
      // Butter is a non-cream-cheese spread; contributes 0 to the cream-cheese order.
      components: [{ name: "Butter", grams: 36 * LB }],
    },
    {
      key: "schmear_rotator",
      name: "Rotator Schmear",
      pct: 0,
      // The week's rotating schmear. Default to a cream-cheese base; edit per week in Settings.
      components: [{ name: "Cream cheese", grams: 36 * LB }],
    },
  ],
};

/** The 5 flavors: 4 permanent + 1 weekly rotator. pct = default share of the daily bake. */
export const DEFAULT_FLAVORS = [
  { name: "Everything", pct: 40, isRotator: false, order: 1 },
  { name: "Plain", pct: 15, isRotator: false, order: 2 },
  { name: "Asiago", pct: 15, isRotator: false, order: 3 },
  { name: "Salt", pct: 15, isRotator: false, order: 4 },
  { name: "Rotator", pct: 15, isRotator: true, order: 5 },
];

export interface AppConfig {
  openTime: string;
  closeTime: string;
  lockDeadlineDow: number; // 2 = Tuesday
  alertWindowDays: number;
  dough: DoughRecipe;
  starter: StarterConfig;
  schmear: SchmearConfig;
}

export const DEFAULT_CONFIG: AppConfig = {
  openTime: "08:00",
  closeTime: "13:00",
  lockDeadlineDow: 2, // Tuesday
  alertWindowDays: 3,
  dough: DEFAULT_DOUGH,
  starter: DEFAULT_STARTER,
  schmear: DEFAULT_SCHMEAR,
};

/** The settings rows that encode the defaults (used by seeding / reset). */
export function defaultSettingRows(): { key: string; value: string }[] {
  return [
    { key: "retail_open_time", value: DEFAULT_CONFIG.openTime },
    { key: "retail_close_time", value: DEFAULT_CONFIG.closeTime },
    { key: "lock_deadline_dow", value: String(DEFAULT_CONFIG.lockDeadlineDow) },
    { key: "order_alert_window_days", value: String(DEFAULT_CONFIG.alertWindowDays) },
    { key: "dough_recipe", value: JSON.stringify(DEFAULT_DOUGH) },
    { key: "starter_feed", value: JSON.stringify(DEFAULT_STARTER) },
    { key: "schmear_config", value: JSON.stringify(DEFAULT_SCHMEAR) },
    { key: "service_level", value: "0.85" },
    { key: "recency_decay", value: "0.85" },
  ];
}
