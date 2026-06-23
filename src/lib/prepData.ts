// Shared loader for the weekly prep pages (Schmear / Starter / Dough). Computes the week's
// per-day dough & starter and the weekly schmear from the locked/draft plan.
import { getPlanForWeek } from "./queries";
import { getConfig } from "./serverConfig";
import { appToday } from "./today";
import { weekStartWednesday, addDays } from "./dates";
import { doughForBagels, starterForBagels, weeklySchmear, type DoughResult, type StarterResult, type SchmearResult } from "./calc";
import type { AppConfig } from "./config";

export interface PrepDay {
  date: Date;
  dow: number;
  retail: number;
  wholesale: number;
  bagels: number; // retail + wholesale (everything baked)
  dough: DoughResult;
  starter: StarterResult;
}

export interface WeekPrep {
  status: string;
  days: PrepDay[];
  weeklyBagels: number;
  weeklyRetail: number;
  weeklyWholesale: number;
  schmear: SchmearResult;
  doughFlour: number;
  feedFlour: number;
  honey: number;
  salt: number;
  totalFlour: number;
}

export async function loadWeekPrep(): Promise<{ targetWed: Date; config: AppConfig; prep: WeekPrep | null }> {
  const today = appToday();
  const targetWed = addDays(weekStartWednesday(today), 7);
  const [plan, config] = await Promise.all([getPlanForWeek(targetWed), getConfig()]);
  if (!plan) return { targetWed, config, prep: null };

  // Dough/starter use everything baked (retail + wholesale); schmear is retail-only.
  const days: PrepDay[] = plan.days.map((d) => {
    const bake = d.plannedTotal + d.wholesaleExtra;
    return {
      date: d.date,
      dow: d.dayOfWeek,
      retail: d.plannedTotal,
      wholesale: d.wholesaleExtra,
      bagels: bake,
      dough: doughForBagels(bake, config.dough),
      starter: starterForBagels(bake, config.dough, config.starter),
    };
  });

  const weeklyBagels = days.reduce((s, d) => s + d.bagels, 0);
  const weeklyRetail = days.reduce((s, d) => s + d.retail, 0);
  const weeklyWholesale = days.reduce((s, d) => s + d.wholesale, 0);
  const schmear = weeklySchmear(weeklyRetail, config.schmear);
  const doughFlour = days.reduce((s, d) => s + d.dough.flourG, 0);
  const feedFlour = days.reduce((s, d) => s + d.starter.flourG, 0);
  const honey = days.reduce((s, d) => s + d.dough.honeyG, 0);
  const salt = days.reduce((s, d) => s + d.dough.saltG, 0);
  const totalFlour = doughFlour + feedFlour;

  return {
    targetWed,
    config,
    prep: { status: plan.status, days, weeklyBagels, weeklyRetail, weeklyWholesale, schmear, doughFlour, feedFlour, honey, salt, totalFlour },
  };
}
