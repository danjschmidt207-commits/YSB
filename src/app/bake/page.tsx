import Link from "next/link";
import { getActiveFlavors, getBakeRecord, getRecentBakeRecords } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { appToday } from "@/lib/today";
import { isoDate, shortLabel, DOW_SHORT, isOpenDay, dow } from "@/lib/dates";
import BakeEntryForm from "./BakeEntryForm";
import RefreshSalesButton from "./RefreshSalesButton";

export const dynamic = "force-dynamic";

export default async function BakePage() {
  const today = appToday();
  const todayIso = isoDate(today);
  const [flavors, settings, record, recent] = await Promise.all([
    getActiveFlavors(),
    getSettings(),
    getBakeRecord(today),
    getRecentBakeRecords(15),
  ]);

  const bakedMap: Record<number, number> = {};
  for (const f of flavors) bakedMap[f.id] = 0;
  if (record) for (const l of record.lines) bakedMap[l.flavorId] = l.qtyBaked;

  const open = isOpenDay(dow(today));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Daily Bake &amp; Sales</h1>
        <p className="text-sm text-crust/60">
          {shortLabel(today)} · {open ? "open day" : "closed day (Mon/Tue)"}
        </p>
      </header>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Morning entry — {shortLabel(today)}</h2>
          {record && <RefreshSalesButton dateIso={todayIso} />}
        </div>
        {!open && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You&apos;re closed today, but you can still record or back-fill any date below.
          </p>
        )}
        <BakeEntryForm
          dateIso={todayIso}
          flavors={flavors.map((f) => ({ id: f.id, name: f.name }))}
          initial={{
            openTime: record?.retailOpenTime ?? settings.retailOpenTime,
            closeTime: record?.retailCloseTime ?? settings.retailCloseTime,
            notes: record?.notes ?? "",
            baked: bakedMap,
          }}
        />
        {record && (
          <p className="text-xs text-crust/50">
            After saving, pull sales to see sold &amp; sold-out detail on the{" "}
            <Link href={`/bake/${todayIso}`} className="underline">
              day page
            </Link>
            .
          </p>
        )}
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
                <th className="th text-right">Sell-through</th>
                <th className="th text-center">Sold out</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => {
                const st = r.totalBaked > 0 ? Math.round((r.totalSold / r.totalBaked) * 100) : 0;
                return (
                  <tr key={r.id} className="border-t border-crust/5 hover:bg-crust/5">
                    <td className="td">
                      <Link href={`/bake/${isoDate(r.date)}`} className="font-semibold underline-offset-2 hover:underline">
                        {DOW_SHORT[r.dayOfWeek]} {isoDate(r.date).slice(5)}
                      </Link>
                    </td>
                    <td className="td text-right">{r.totalBaked}</td>
                    <td className="td text-right">{r.totalSold}</td>
                    <td className="td text-right">{st}%</td>
                    <td className="td text-center">
                      {r.soldOut ? (
                        <span className="pill bg-red-100 text-red-700">out {r.soldOutTime ?? ""}</span>
                      ) : (
                        <span className="text-crust/30">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
