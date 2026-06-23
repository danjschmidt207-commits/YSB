import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveFlavors, loadWeekdayHistory } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { forecastWeekday } from "@/lib/forecast";
import { DOW_NAMES, DOW_SHORT, isOpenDay } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function WeekdayDetail({ params }: { params: { dow: string } }) {
  const dw = Number(params.dow);
  if (!Number.isInteger(dw) || dw < 0 || dw > 6 || !isOpenDay(dw)) notFound();

  const [flavors, settings, history] = await Promise.all([
    getActiveFlavors(),
    getSettings(),
    loadWeekdayHistory(dw, 8),
  ]);
  const flavorName = new Map(flavors.map((f) => [f.id, f.name]));
  const fc = forecastWeekday(history, settings.forecast);

  return (
    <div className="space-y-6">
      <Link href="/plan" className="text-sm text-crust/60 underline">
        ← Plan
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold">{DOW_NAMES[dw]}</h1>
        <p className="text-sm text-crust/60">
          Last {fc.sampleSize} occurrences · {fc.soldOutCount} sold out · targeting {Math.round(settings.forecast.serviceLevel * 100)}% service level
        </p>
      </header>

      {/* Recommendation */}
      <section className="card space-y-3 border-crust/20 bg-sesame/20">
        <div className="flex items-end justify-between">
          <div>
            <div className="label">Recommended bake</div>
            <div className="text-4xl font-extrabold tabular-nums">{fc.recommendedTotal}</div>
          </div>
          <div className="text-right text-xs text-crust/50">de-censored<br />percentile method</div>
        </div>
        <p className="text-sm leading-relaxed text-crust/80">{fc.reasoning}</p>

        <div className="overflow-hidden rounded-xl border border-crust/10 bg-white">
          <table className="w-full">
            <thead className="bg-crust/5">
              <tr>
                <th className="th">Flavor</th>
                <th className="th text-right">Rec. qty</th>
                <th className="th text-right">Demand share</th>
                <th className="th text-right">Sold out</th>
              </tr>
            </thead>
            <tbody>
              {fc.perFlavor.map((p) => (
                <tr key={p.flavorId} className="border-t border-crust/5">
                  <td className="td font-semibold">{flavorName.get(p.flavorId) ?? `#${p.flavorId}`}</td>
                  <td className="td text-right font-bold">{p.recommendedQty}</td>
                  <td className="td text-right">{Math.round(p.share * 100)}%</td>
                  <td className="td text-right">
                    {p.soldOutCount > 0 ? `${p.soldOutCount}/${fc.sampleSize}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Trailing-8 history with de-censored demand */}
      <section className="space-y-2">
        <h2 className="font-bold">Last {fc.sampleSize} {DOW_NAMES[dw]}s</h2>
        <div className="overflow-x-auto rounded-2xl border border-crust/10 bg-white">
          <table className="w-full min-w-[34rem]">
            <thead className="bg-crust/5">
              <tr>
                <th className="th">Date</th>
                <th className="th text-right">Baked</th>
                <th className="th text-right">Sold</th>
                <th className="th text-center">Sold out</th>
                <th className="th text-right" title="de-censored demand estimate">True demand*</th>
                <th className="th text-right">Weight</th>
              </tr>
            </thead>
            <tbody>
              {fc.records.map((r) => (
                <tr key={r.date} className={`border-t border-crust/5 ${r.censored ? "bg-red-50/40" : ""}`} title={r.method}>
                  <td className="td">
                    <Link href={`/bake/${r.date}`} className="underline-offset-2 hover:underline">
                      {DOW_SHORT[dw]} {r.date.slice(5)}
                    </Link>
                    {r.source === "square" && (
                      <span className="ml-1 align-middle text-[10px] uppercase tracking-wide text-crust/40" title="Reconstructed from Square sales; sold-out inferred from the last sale time">
                        ·sq
                      </span>
                    )}
                  </td>
                  <td className="td text-right">{r.baked}</td>
                  <td className="td text-right">{r.sold}</td>
                  <td className="td text-center">
                    {r.soldOut ? <span className="pill bg-red-100 text-red-700">out {r.soldOutTime ?? ""}</span> : <span className="text-crust/30">—</span>}
                  </td>
                  <td className="td text-right font-semibold">
                    {Math.round(r.deCensoredDemand)}
                    {r.censored && <span className="ml-1 text-xs text-red-600">↑</span>}
                  </td>
                  <td className="td text-right text-crust/50">{r.weight.toFixed(2)}</td>
                </tr>
              ))}
              {fc.records.length === 0 && (
                <tr>
                  <td className="td text-crust/50" colSpan={6}>
                    No history yet for this weekday.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-crust/50">
          *On sold-out days, sold is only a floor on demand. <span className="text-red-600">True demand↑</span> de-censors it
          using the sell-out time and a front-loaded intraday curve (spec §7). Recent weeks weigh more.
          Rows marked <span className="uppercase">·sq</span> predate bake tracking and are reconstructed from Square sales —
          sold-out is inferred when the day&apos;s last sale landed well before the noon close. Enter a bake record for any day to override it.
        </p>
      </section>
    </div>
  );
}
