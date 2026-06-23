import Link from "next/link";
import { loadWeekPrep } from "@/lib/prepData";
import { shortLabel, isoDate, DOW_NAMES } from "@/lib/dates";
import { doughBatches, g, lb } from "@/lib/calc";
import { LB } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function DoughPage() {
  const { targetWed, config, prep } = await loadWeekPrep();

  if (!prep) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Dough</h1>
        <div className="card">
          No plan yet for the week of {shortLabel(targetWed)}.{" "}
          <Link href="/plan" className="underline">Create one in Plan</Link> — dough amounts come from each day&apos;s bake.
        </div>
      </div>
    );
  }

  const maxBatchG = config.doughBatchMaxLb * LB;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Dough</h1>
          <p className="text-sm text-crust/60">
            Week of {shortLabel(targetWed)} · {config.dough.bagelWeightG} g/bagel · max {config.doughBatchMaxLb} lb/batch
          </p>
        </div>
        <Link href="/settings" className="text-sm text-crust/60 underline">Batch size →</Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {prep.days.map((d) => {
          const { count, perBatchG } = doughBatches(d.dough.totalDoughG, maxBatchG);
          const per = (whole: number) => (count > 0 ? whole / count : 0);
          return (
            <div key={d.dow} className="card space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold">{DOW_NAMES[d.dow]} <span className="text-sm font-normal text-crust/40">{isoDate(d.date).slice(5)}</span></span>
                <span className="text-xs text-crust/50">{d.bagels} bagels · {lb(d.dough.totalDoughG)} dough</span>
              </div>

              {count === 0 ? (
                <p className="text-sm text-crust/40">No bake planned.</p>
              ) : (
                <>
                  <div className="rounded-xl bg-amber-100/60 px-3 py-2 text-amber-900">
                    <span className="text-2xl font-extrabold">{count}</span>
                    <span className="font-semibold"> {count === 1 ? "batch" : "batches"}</span>
                    <span className="text-sm"> · {lb(perBatchG)} each ({(perBatchG / 1000).toFixed(1)} kg)</span>
                  </div>
                  <div className="text-xs font-medium text-crust/45">Per batch</div>
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        ["Flour", d.dough.flourG],
                        ["Starter", d.dough.starterG],
                        ["Water", d.dough.waterG],
                        ["Honey", d.dough.honeyG],
                        ["Salt", d.dough.saltG],
                      ].map(([name, whole]) => (
                        <tr key={name as string} className="border-t border-crust/5">
                          <td className="py-1 text-crust/70">{name}</td>
                          <td className="py-1 text-right font-semibold tabular-nums">{g(per(whole as number))}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-crust/10">
                        <td className="py-1 font-semibold">Dough / batch</td>
                        <td className="py-1 text-right font-semibold tabular-nums">{(perBatchG / 1000).toFixed(1)} kg</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-crust/50">
        Each day is split into the fewest equal batches that stay under {config.doughBatchMaxLb} lb (editable in Settings).
        Mix each batch to the per-batch amounts above.
      </p>
    </div>
  );
}
