import Link from "next/link";
import { loadWeekPrep } from "@/lib/prepData";
import { shortLabel, isoDate, DOW_SHORT } from "@/lib/dates";
import { g, lb, gLb } from "@/lib/calc";

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

  const { days, doughFlour, feedFlour, honey, salt, totalFlour, weeklyBagels } = prep;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Dough</h1>
          <p className="text-sm text-crust/60">
            Week of {shortLabel(targetWed)} · {weeklyBagels} bagels · {config.dough.bagelWeightG} g/bagel
          </p>
        </div>
        <Link href="/bake" className="text-sm text-crust/60 underline">Bake →</Link>
      </header>

      {/* Weekly ingredient order */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Flour to order" value={lb(totalFlour)} sub={`${(totalFlour / 1000).toFixed(1)} kg`} />
        <Kpi label="Honey" value={lb(honey)} sub={g(honey)} />
        <Kpi label="Salt (dough)" value={g(salt)} sub="" />
        <Kpi label="Dough flour" value={lb(doughFlour)} sub={`+ feed ${lb(feedFlour)}`} />
      </section>

      <section className="card space-y-2">
        <p className="text-xs text-crust/50">
          Ratio flour {config.dough.flour} : starter {config.dough.starter} : water {config.dough.water} : honey {config.dough.honey} : salt {config.dough.salt}.
          Dough is mixed the morning before each bake day.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr>
                <th className="th">Bake day</th>
                <th className="th text-right">Bagels</th>
                <th className="th text-right">Dough</th>
                <th className="th text-right">Flour</th>
                <th className="th text-right">Starter</th>
                <th className="th text-right">Water</th>
                <th className="th text-right">Honey</th>
                <th className="th text-right">Salt</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.dow} className="border-t border-crust/5">
                  <td className="td font-semibold">{DOW_SHORT[d.dow]} {isoDate(d.date).slice(5)}</td>
                  <td className="td text-right">{d.bagels}</td>
                  <td className="td text-right">{(d.dough.totalDoughG / 1000).toFixed(1)} kg</td>
                  <td className="td text-right">{g(d.dough.flourG)}</td>
                  <td className="td text-right">{g(d.dough.starterG)}</td>
                  <td className="td text-right">{g(d.dough.waterG)}</td>
                  <td className="td text-right">{g(d.dough.honeyG)}</td>
                  <td className="td text-right">{g(d.dough.saltG)}</td>
                </tr>
              ))}
              <tr className="border-t border-crust/20 font-semibold">
                <td className="td">Week</td>
                <td className="td text-right">{weeklyBagels}</td>
                <td className="td text-right">{(days.reduce((s, d) => s + d.dough.totalDoughG, 0) / 1000).toFixed(1)} kg</td>
                <td className="td text-right">{g(doughFlour)}</td>
                <td className="td text-right">{g(days.reduce((s, d) => s + d.dough.starterG, 0))}</td>
                <td className="td text-right">{g(days.reduce((s, d) => s + d.dough.waterG, 0))}</td>
                <td className="td text-right">{g(honey)}</td>
                <td className="td text-right">{g(salt)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-crust/50">
          Total flour to order = dough flour ({g(doughFlour)}) + starter-feed flour ({g(feedFlour)}) = <strong>{gLb(totalFlour)}</strong>.
        </p>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card !p-3 text-center">
      <div className="label">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-crust/40">{sub}</div>}
    </div>
  );
}
