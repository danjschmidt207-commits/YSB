import Link from "next/link";
import { getActiveFlavors, getBakeRecord, getRecentBakeRecords, getDayPlan, getWeekDayPlans } from "@/lib/queries";
import { getConfig } from "@/lib/serverConfig";
import { appToday } from "@/lib/today";
import { isoDate, shortLabel, DOW_SHORT, parseIsoDate } from "@/lib/dates";
import { DayBoards } from "@/components/DayBoards";
import BakeEntryForm from "./BakeEntryForm";
import DateNav from "./DateNav";

export const dynamic = "force-dynamic";

export default async function BakePage({ searchParams }: { searchParams: { date?: string } }) {
  const today = appToday();
  const date = searchParams.date ? parseIsoDate(searchParams.date) : today;
  const dateIso = isoDate(date);

  const [flavors, config, record, recent, dayPlan, weekDays] = await Promise.all([
    getActiveFlavors(),
    getConfig(),
    getBakeRecord(date),
    getRecentBakeRecords(15),
    getDayPlan(date),
    getWeekDayPlans(date),
  ]);

  // Pre-fill baked from the existing record, else from the plan's flavor split for that day.
  const bakedMap: Record<number, number> = {};
  const leftoverMap: Record<number, number> = {};
  for (const f of flavors) {
    bakedMap[f.id] = 0;
    leftoverMap[f.id] = 0;
  }
  if (record) {
    for (const l of record.lines) {
      bakedMap[l.flavorId] = l.qtyBaked;
      leftoverMap[l.flavorId] = Math.max(0, l.qtyBaked - l.qtySold);
    }
  } else {
    for (const s of dayPlan.flavors) bakedMap[s.flavorId] = s.qty;
  }
  const hasPlan = !record && dayPlan.hasPlan;

  // The selected day large + highlighted; the rest of the week as small clickable cards.
  const others = weekDays.filter((d) => d.dateIso !== dateIso);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">Daily Bake</h1>
          <p className="text-sm text-crust/60">
            {shortLabel(date)} {dateIso !== isoDate(today) && <span className="pill ml-1 bg-amber-100 text-amber-700">back-fill</span>}
          </p>
        </div>
        <DateNav dateIso={dateIso} />
      </header>

      {/* Boil & season — selected day large, rest of week small */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">Boil &amp; season</h2>
          <span className="text-xs text-crust/50">24/board · ½-board steps</span>
        </div>
        <DayBoards day={dayPlan} size="lg" highlight />
        {others.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {others.map((d) => (
              <DayBoards key={d.dateIso} day={d} size="sm" href={`/bake?date=${d.dateIso}`} />
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="font-bold">Enter results</h2>
        <BakeEntryForm
          dateIso={dateIso}
          flavors={flavors.map((f) => ({ id: f.id, name: f.name }))}
          hasPlan={hasPlan}
          initial={{
            openTime: record?.retailOpenTime ?? config.openTime,
            closeTime: record?.retailCloseTime ?? config.closeTime,
            notes: record?.notes ?? "",
            soldOut: record?.soldOut ?? false,
            soldOutTime: record?.soldOutTime ?? "",
            baked: bakedMap,
            leftover: leftoverMap,
          }}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Recent days</h2>
        <div className="overflow-hidden rounded-2xl border border-crust/10 bg-white">
          <table className="w-full">
            <thead className="bg-crust/5">
              <tr>
                <th className="th">Day</th>
                <th className="th text-right">Baked</th>
                <th className="th text-right">Sold</th>
                <th className="th text-right">Left</th>
                <th className="th text-center">Sold out</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-crust/5 hover:bg-crust/5">
                  <td className="td">
                    <Link href={`/bake?date=${isoDate(r.date)}`} className="font-semibold underline-offset-2 hover:underline">
                      {DOW_SHORT[r.dayOfWeek]} {isoDate(r.date).slice(5)}
                    </Link>
                  </td>
                  <td className="td text-right">{r.totalBaked}</td>
                  <td className="td text-right">{r.totalSold}</td>
                  <td className="td text-right">{r.totalBaked - r.totalSold}</td>
                  <td className="td text-center">
                    {r.soldOut ? <span className="pill bg-red-100 text-red-700">out {r.soldOutTime ?? ""}</span> : <span className="text-crust/30">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
