import { NextResponse } from "next/server";
import { refreshSales } from "@/app/actions";
import { appToday } from "@/lib/today";
import { isoDate } from "@/lib/dates";

// INT-2: pull completed sales and attribute per flavor. Designed to be hit by a
// scheduled job (Vercel Cron / Supabase scheduled function) as well as on-demand.
//   POST /api/square/pull            -> pulls today
//   POST /api/square/pull {date}     -> pulls a specific YYYY-MM-DD
export async function POST(req: Request) {
  let date = isoDate(appToday());
  try {
    const body = await req.json();
    if (body?.date) date = body.date;
  } catch {
    // no body — default to today
  }
  const result = await refreshSales(date);
  return NextResponse.json({ date, ...result });
}
