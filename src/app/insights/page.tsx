import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveFlavors, loadSquareDayAggregates } from "@/lib/queries";
import { getConfig } from "@/lib/serverConfig";
import { DOW_NAMES, DOW_SHORT, OPEN_DOWS, isoDate } from "@/lib/dates";
import { ApplyMixButton } from "./InsightsClient";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const total = await prisma.squareSale.count();
  if (total === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Insights</h1>
        <div className="card">
          No Square sales imported yet. Go to <Link href="/settings" className="underline">Settings → Square</Link> to
          connect and import — then this page shows your real flavor mix, schmear mix, and bake suggestions.
        </div>
      </div>
    );
  }

  const [flavors, config, flavorGroups, schmearGroups, daily, range, unmappedRow] = await Promise.all([
    getActiveFlavors(),
    getConfig(),
    prisma.squareSale.groupBy({ by: ["flavorId"], where: { flavorId: { not: null } }, _sum: { qty: true } }),
    prisma.squareSale.groupBy({ by: ["schmearKey"], where: { schmearKey: { not: null } }, _sum: { qty: true } }),
    prisma.squareSale.groupBy({ by: ["date", "dayOfWeek"], where: { flavorId: { not: null } }, _sum: { qty: true } }),
    prisma.squareSale.aggregate({ _min: { date: true }, _max: { date: true } }),
    prisma.appSetting.findUnique({ where: { key: "square_unmapped" } }),
  ]);
  const dayAggs = (await loadSquareDayAggregates()).sort((a, b) => (a.date < b.date ? 1 : -1));

  const flavorName = new Map(flavors.map((f) => [f.id, f.name]));
  const flavorPct = new Map(flavors.map((f) => [f.id, f.pct]));
  const schmearName = new Map(config.schmear.types.map((t) => [t.key, t.name]));
  const schmearPct = new Map(config.schmear.types.map((t) => [t.key, t.pct]));

  const flavorTotal = flavorGroups.reduce((s, g) => s + (g._sum.qty ?? 0), 0);
  const schmearTotal = schmearGroups.reduce((s, g) => s + (g._sum.qty ?? 0), 0);
  const unmapped: string[] = unmappedRow ? JSON.parse(unmappedRow.value) : [];

  // Avg bagels sold per weekday.
  const byDow = new Map<number, { totalQty: number; days: Set<string> }>();
  for (const d of daily) {
    const e = byDow.get(d.dayOfWeek) ?? { totalQty: 0, days: new Set<string>() };
    e.totalQty += d._sum.qty ?? 0;
    e.days.add(isoDate(d.date));
    byDow.set(d.dayOfWeek, e);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Insights</h1>
        <p className="text-sm text-crust/60">
          From {total.toLocaleString()} Square sale lines
          {range._min.date ? ` · ${isoDate(range._min.date)} → ${isoDate(range._max.date!)}` : ""}.
          {unmapped.length > 0 && (
            <> <Link href="/settings" className="text-amber-700 underline">{unmapped.length} unmapped</Link></>
          )}
        </p>
      </header>

      {/* Flavor mix */}
      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Flavor mix (actual)</h2>
          <ApplyMixButton kind="flavor" label="Apply to flavor %" />
        </div>
        <table className="w-full text-sm">
          <thead className="text-crust/50">
            <tr><th className="th">Flavor</th><th className="th text-right">Sold</th><th className="th text-right">Actual %</th><th className="th text-right">Current %</th></tr>
          </thead>
          <tbody>
            {flavorGroups
              .map((g) => ({ id: g.flavorId as number, qty: g._sum.qty ?? 0 }))
              .sort((a, b) => b.qty - a.qty)
              .map((g) => {
                const actual = flavorTotal ? Math.round((g.qty / flavorTotal) * 100) : 0;
                const cur = flavorPct.get(g.id) ?? 0;
                return (
                  <tr key={g.id} className="border-t border-crust/5">
                    <td className="td font-semibold">{flavorName.get(g.id) ?? `#${g.id}`}</td>
                    <td className="td text-right">{g.qty.toLocaleString()}</td>
                    <td className="td text-right font-semibold">{actual}%</td>
                    <td className={`td text-right ${Math.abs(actual - cur) >= 5 ? "text-amber-600" : "text-crust/40"}`}>{cur}%</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </section>

      {/* Schmear mix */}
      {schmearTotal > 0 && (
        <section className="card space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Schmear mix (actual)</h2>
            <ApplyMixButton kind="schmear" label="Apply to schmear %" />
          </div>
          <table className="w-full text-sm">
            <thead className="text-crust/50">
              <tr><th className="th">Schmear</th><th className="th text-right">Sold</th><th className="th text-right">Actual %</th><th className="th text-right">Current %</th></tr>
            </thead>
            <tbody>
              {schmearGroups
                .map((g) => ({ key: g.schmearKey as string, qty: g._sum.qty ?? 0 }))
                .sort((a, b) => b.qty - a.qty)
                .map((g) => {
                  const actual = schmearTotal ? Math.round((g.qty / schmearTotal) * 100) : 0;
                  const cur = schmearPct.get(g.key) ?? 0;
                  return (
                    <tr key={g.key} className="border-t border-crust/5">
                      <td className="td font-semibold">{schmearName.get(g.key) ?? g.key}</td>
                      <td className="td text-right">{g.qty.toLocaleString()}</td>
                      <td className="td text-right font-semibold">{actual}%</td>
                      <td className={`td text-right ${Math.abs(actual - cur) >= 5 ? "text-amber-600" : "text-crust/40"}`}>{cur}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      )}

      {/* Per-day sales with sold-out flag */}
      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">By day</h2>
          <span className="text-xs text-crust/50">{dayAggs.filter((d) => d.soldOut).length} of {dayAggs.length} days sold out</span>
        </div>
        <p className="text-xs text-crust/50">
          Bagels sold each day. <span className="text-red-600">Sold out</span> days are inferred from the last sale landing
          well before the noon close — on those days true demand was <em>higher</em> than sold (the Plan forecaster de-censors them).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="text-crust/50">
              <tr>
                <th className="th">Day</th>
                <th className="th text-right">Sold</th>
                <th className="th text-center">Sold out</th>
                <th className="th text-right">Last sale</th>
              </tr>
            </thead>
            <tbody>
              {dayAggs.map((d) => (
                <tr key={d.date} className={`border-t border-crust/5 ${d.soldOut ? "bg-red-50/40" : ""}`}>
                  <td className="td font-semibold">
                    {DOW_SHORT[d.dow]} <span className="text-crust/50">{d.date.slice(5)}</span>
                  </td>
                  <td className="td text-right tabular-nums">{d.sold.toLocaleString()}</td>
                  <td className="td text-center">
                    {d.soldOut ? <span className="pill bg-red-100 text-red-700">sold out</span> : <span className="text-crust/30">—</span>}
                  </td>
                  <td className="td text-right text-crust/50">{d.lastSale ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Suggested bake per weekday */}
      <section className="card space-y-2">
        <h2 className="font-bold">Demand by weekday</h2>
        <p className="text-xs text-crust/50">Average bagels sold per day, from Square. Suggested bake adds a 10% cushion above average demand.</p>
        <table className="w-full text-sm">
          <thead className="text-crust/50">
            <tr><th className="th">Day</th><th className="th text-right">Days</th><th className="th text-right">Avg sold</th><th className="th text-right">Suggested bake</th></tr>
          </thead>
          <tbody>
            {(OPEN_DOWS as readonly number[]).map((dw) => {
              const e = byDow.get(dw);
              const days = e ? e.days.size : 0;
              const avg = days ? Math.round(e!.totalQty / days) : 0;
              const suggest = Math.round((avg * 1.1) / 5) * 5;
              return (
                <tr key={dw} className="border-t border-crust/5">
                  <td className="td font-semibold">{DOW_NAMES[dw]}</td>
                  <td className="td text-right">{days}</td>
                  <td className="td text-right">{avg}</td>
                  <td className="td text-right font-semibold">{suggest || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-crust/50">
          Tip: the Plan page also forecasts using de-censored demand (accounting for sold-out days). Use these averages
          as a sanity check and a starting point.
        </p>
      </section>
    </div>
  );
}
