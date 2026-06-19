// Server-only: loads the merged AppConfig from AppSetting overrides + defaults.
import { prisma } from "./db";
import {
  DEFAULT_CONFIG,
  DEFAULT_DOUGH,
  DEFAULT_STARTER,
  DEFAULT_SCHMEAR,
  type AppConfig,
  type SchmearConfig,
} from "./config";

function mergeJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

export async function getConfig(): Promise<AppConfig> {
  const rows = await prisma.appSetting.findMany();
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return {
    openTime: m.get("retail_open_time") ?? DEFAULT_CONFIG.openTime,
    closeTime: m.get("retail_close_time") ?? DEFAULT_CONFIG.closeTime,
    lockDeadlineDow: m.has("lock_deadline_dow") ? Number(m.get("lock_deadline_dow")) : DEFAULT_CONFIG.lockDeadlineDow,
    alertWindowDays: m.has("order_alert_window_days") ? Number(m.get("order_alert_window_days")) : DEFAULT_CONFIG.alertWindowDays,
    dough: mergeJson(m.get("dough_recipe"), DEFAULT_DOUGH),
    starter: mergeJson(m.get("starter_feed"), DEFAULT_STARTER),
    schmear: m.has("schmear_config") ? (JSON.parse(m.get("schmear_config")!) as SchmearConfig) : DEFAULT_SCHMEAR,
  };
}
