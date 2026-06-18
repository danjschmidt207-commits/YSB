import { prisma } from "./db";
import { DEFAULT_CONFIG, type ForecastConfig } from "./forecast";

export interface AppSettings {
  retailOpenTime: string;
  retailCloseTime: string;
  orderDeadlineDow: number; // 0..6
  orderAlertWindowDays: number;
  starterBufferPct: number;
  starterHintAfterHour: number;
  forecast: ForecastConfig;
}

const DEFAULTS: AppSettings = {
  retailOpenTime: "07:00",
  retailCloseTime: "11:00",
  orderDeadlineDow: 4, // Thursday
  orderAlertWindowDays: 3,
  starterBufferPct: 10,
  starterHintAfterHour: 12,
  forecast: DEFAULT_CONFIG,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany();
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => (m.has(k) ? Number(m.get(k)) : d);
  return {
    retailOpenTime: m.get("retail_open_time") ?? DEFAULTS.retailOpenTime,
    retailCloseTime: m.get("retail_close_time") ?? DEFAULTS.retailCloseTime,
    orderDeadlineDow: num("order_deadline_dow", DEFAULTS.orderDeadlineDow),
    orderAlertWindowDays: num("order_alert_window_days", DEFAULTS.orderAlertWindowDays),
    starterBufferPct: num("starter_buffer_pct", DEFAULTS.starterBufferPct),
    starterHintAfterHour: num("starter_hint_after_hour", DEFAULTS.starterHintAfterHour),
    forecast: {
      ...DEFAULT_CONFIG,
      serviceLevel: num("service_level", DEFAULT_CONFIG.serviceLevel),
      recencyDecay: num("recency_decay", DEFAULT_CONFIG.recencyDecay),
    },
  };
}
