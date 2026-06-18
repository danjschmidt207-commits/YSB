import { NextResponse } from "next/server";
import { loadWeekdayHistory } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { forecastWeekday } from "@/lib/forecast";
import { isOpenDay, DOW_NAMES } from "@/lib/dates";

// PLN-2/-3 as a JSON endpoint: GET /api/forecast?dow=4
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dow = Number(searchParams.get("dow"));
  if (!Number.isInteger(dow) || dow < 0 || dow > 6 || !isOpenDay(dow)) {
    return NextResponse.json({ error: "dow must be an open weekday (0=Sun, 3=Wed..6=Sat)" }, { status: 400 });
  }
  const settings = await getSettings();
  const history = await loadWeekdayHistory(dow, 8);
  const fc = forecastWeekday(history, settings.forecast);
  return NextResponse.json({ weekday: DOW_NAMES[dow], ...fc });
}
