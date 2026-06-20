import { prisma } from "@/lib/db";
import { getActiveFlavors } from "@/lib/queries";
import { DOW_NAMES, OPEN_DOWS } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [records, flavors] = await Promise.all([
    prisma.bakeRecord.findMany({ include: { lines: true } }),
    getActiveFlavors(),
  ]);

  if (records.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Reports</h1>
        <div className="card">No history yet. Enter a few days on the Bake page and trends will appear here.</div>
      </div>
    );
  }

  // By weekday.
  const byDow = (OPEN_DOWS as readonly number[]).map((dw) => {
    const rs = records.filter((r) => r.dayOfWeek === dw);
    const baked = rs.reduce((s, r) => s + r.totalBaked, 0);
    const sold = rs.reduce((s, r) => s + r.totalSold, 0);
    const soldOut = rs.filter((r) => r.soldOut).length;
    return {
      dw,
      n: rs.length,
      avgBaked: rs.length ? Math.round(baked / rs.length) : 0,
      avgSold: rs.length ? Math.round(sold / rs.length) : 0,
      sellThrough: baked ? Math.round((sold / baked) * 100) : 0,
      avgWaste: rs.length ? Math.round((baked - sold) / rs.length) : 0,
      soldOutPct: rs.length ? Math.round((soldOut / rs.length) * 100) : 0,
    };
  });

  // By flavor.
  const flavorMap = new Map(flavors.map((f) => [f.id, f.name]));
  const fAgg = new Map<number, { baked: number; sold: number; soldOut: number; days: number }>();
  for (const r of records) {
    for (const l of r.lines) {
      const a = fAgg.get(l.flavorId) ?? { baked: 0, sold: 0, soldOut: 0, days: 0 };
      a.baked += l.qtyBaked;
      a.sold += l.qtySold;
      a.soldOut += l.flavorSoldOut ? 1 : 0;
      a.days += 1;
      fAgg.set(l.flavorId, a);
    }
  }

  // Overall.
  const totalBaked = records.reduce((s, r) => s + r.totalBaked, 0);
  const totalSold = records.reduce((s, r) => s + r.totalSold, 0);
  const overallST = totalBaked ? Math.round((totalSold / totalBaked) * 100) : 0;
  const totalWaste = totalBaked - totalSold;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Reports</h1>
        <p className="text-sm text-crust/60">{records.length} days recorded · {overallST}% overall sell-through · {totalWaste} total leftover</p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <Kpi label="Sell-through" value={`${overallST}%`} />
        <Kpi label="Total leftover" value={totalWaste} tone={totalWaste > 0 ? "warn" : "ok"} />
        <Kpi label="Days tracked" value={records.length} />
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">By weekday</h2>
        <div className="overflow-x-auto rounded-2xl border border-crust/10 bg-white">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-crust/5">
              <tr>
                <th className="th">Day</th>
                <th className="th text-right">Days</th>
                <th className="th text-right">Avg baked</th>
                <th className="th text-right">Avg sold</th>
                <th className="th text-right">Sell-through</th>
                <th className="th text-right">Avg waste</th>
                <th className="th text-right">Sold out</th>
              </tr>
            </thead>
            <tbody>
              {byDow.map((d) => (
                <tr key={d.dw} className="border-t border-crust/5">
                  <td className="td font-semibold">{DOW_NAMES[d.dw]}</td>
                  <td className="td text-right">{d.n}</td>
                  <td className="td text-right">{d.avgBaked}</td>
                  <td className="td text-right">{d.avgSold}</td>
                  <td className="td text-right">{d.sellThrough}%</td>
                  <td className="td text-right">{d.avgWaste}</td>
                  <td className="td text-right">{d.soldOutPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-crust/50">High sell-through + frequent sold-outs ⇒ bake more; low sell-through + high waste ⇒ bake less.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">By flavor</h2>
        <div className="overflow-hidden rounded-2xl border border-crust/10 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-crust/5">
              <tr>
                <th className="th">Flavor</th>
                <th className="th text-right">Baked</th>
                <th className="th text-right">Sold</th>
                <th className="th text-right">Sell-through</th>
                <th className="th text-right">Sold-out days</th>
              </tr>
            </thead>
            <tbody>
              {[...fAgg.entries()]
                .sort((a, b) => b[1].sold - a[1].sold)
                .map(([id, a]) => (
                  <tr key={id} className="border-t border-crust/5">
                    <td className="td font-semibold">{flavorMap.get(id) ?? `#${id}`}</td>
                    <td className="td text-right">{a.baked}</td>
                    <td className="td text-right">{a.sold}</td>
                    <td className="td text-right">{a.baked ? Math.round((a.sold / a.baked) * 100) : 0}%</td>
                    <td className="td text-right">{a.soldOut}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" }) {
  return (
    <div className="card !p-3 text-center">
      <div className="label">{label}</div>
      <div className={`stat ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
    </div>
  );
}
