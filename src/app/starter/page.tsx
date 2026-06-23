import Link from "next/link";
import { loadWeekPrep } from "@/lib/prepData";
import { shortLabel, isoDate, addDays, DOW_NAMES, DOW_SHORT } from "@/lib/dates";
import { g } from "@/lib/calc";

export const dynamic = "force-dynamic";

export default async function StarterPage() {
  const { targetWed, config, prep } = await loadWeekPrep();

  if (!prep) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Starter</h1>
        <div className="card">
          No plan yet for the week of {shortLabel(targetWed)}.{" "}
          <Link href="/plan" className="underline">Create one in Plan</Link> — feed amounts come from each day&apos;s bake.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Starter feeding</h1>
          <p className="text-sm text-crust/60">
            Week of {shortLabel(targetWed)} · feed {config.starter.leadNights} nights ahead (ratio {config.starter.seed}:{config.starter.flour}:{config.starter.water}, +{config.starter.bufferPct}% buffer)
          </p>
        </div>
        <Link href="/dough" className="text-sm text-crust/60 underline">Dough →</Link>
      </header>

      <section className="card space-y-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr>
                <th className="th">Feed night</th>
                <th className="th">For bake day</th>
                <th className="th text-right">Build</th>
                <th className="th text-right">Starter</th>
                <th className="th text-right">Flour</th>
                <th className="th text-right">Water</th>
              </tr>
            </thead>
            <tbody>
              {prep.days.map((d) => {
                const feedNight = addDays(d.date, -config.starter.leadNights);
                return (
                  <tr key={d.dow} className="border-t border-crust/5">
                    <td className="td font-semibold">{DOW_NAMES[feedNight.getUTCDay()]} night</td>
                    <td className="td">{DOW_SHORT[d.dow]} {isoDate(d.date).slice(5)}</td>
                    <td className="td text-right font-semibold">{g(d.starter.buildG)}</td>
                    <td className="td text-right">{g(d.starter.seedG)}</td>
                    <td className="td text-right">{g(d.starter.flourG)}</td>
                    <td className="td text-right">{g(d.starter.waterG)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-crust/50">
          &quot;Build&quot; is total starter to make that night (needed for dough + {config.starter.bufferPct}% buffer), split into seed/flour/water by the feed ratio.
        </p>
      </section>
    </div>
  );
}
