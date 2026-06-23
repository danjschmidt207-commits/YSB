import Link from "next/link";
import { getPlanForWeek } from "@/lib/queries";
import { getConfig } from "@/lib/serverConfig";
import { appToday } from "@/lib/today";
import { weekStartWednesday, addDays, isoDate, shortLabel, DOW_NAMES, DOW_SHORT } from "@/lib/dates";
import { doughForBagels, starterForBagels, weeklySchmear, g, lb, gLb } from "@/lib/calc";

export const dynamic = "force-dynamic";

export default async function PrepPage() {
  const today = appToday();
  const targetWed = addDays(weekStartWednesday(today), 7);
  const [plan, config] = await Promise.all([getPlanForWeek(targetWed), getConfig()]);

  if (!plan) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Prep</h1>
        <div className="card">
          No plan yet for the week of {shortLabel(targetWed)}.{" "}
          <Link href="/plan" className="underline">
            Create one in Plan
          </Link>{" "}
          first — prep amounts are calculated from the week&apos;s totals.
        </div>
      </div>
    );
  }

  // Dough/starter are calculated from everything baked (retail + wholesale). Schmear is retail-only
  // (wholesale orders are bagels without schmear).
  const days = plan.days.map((d) => {
    const bake = d.plannedTotal + d.wholesaleExtra;
    return {
      date: d.date,
      dow: d.dayOfWeek,
      retail: d.plannedTotal,
      wholesale: d.wholesaleExtra,
      bagels: bake,
      dough: doughForBagels(bake, config.dough),
      starter: starterForBagels(bake, config.dough, config.starter),
    };
  });

  const weeklyBagels = days.reduce((s, d) => s + d.bagels, 0);
  const weeklyRetail = days.reduce((s, d) => s + d.retail, 0);
  const weeklyWholesale = days.reduce((s, d) => s + d.wholesale, 0);
  const schmear = weeklySchmear(weeklyRetail, config.schmear);

  // Weekly ordering totals.
  const doughFlour = days.reduce((s, d) => s + d.dough.flourG, 0);
  const feedFlour = days.reduce((s, d) => s + d.starter.flourG, 0);
  const honey = days.reduce((s, d) => s + d.dough.honeyG, 0);
  const salt = days.reduce((s, d) => s + d.dough.saltG, 0);
  const totalFlour = doughFlour + feedFlour;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Prep</h1>
          <p className="text-sm text-crust/60">
            Week of {shortLabel(targetWed)} · {weeklyBagels} bagels to bake
            {weeklyWholesale > 0 && ` (${weeklyRetail} retail + ${weeklyWholesale} wholesale)`} · plan {plan.status}
          </p>
        </div>
        <Link href="/plan" className="text-sm text-crust/60 underline">
          Edit plan →
        </Link>
      </header>

      {/* Order summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Flour to order" value={lb(totalFlour)} sub={`${(totalFlour / 1000).toFixed(1)} kg`} />
        <Kpi label="Honey" value={lb(honey)} sub={g(honey)} />
        <Kpi label="Cream cheese" value={`${schmear.creamCheeseTotalLb.toFixed(0)} lb`} sub="for schmears" />
        <Kpi label="Salt (dough)" value={g(salt)} sub="" />
      </section>

      {/* Schmear prep — Tuesday */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Schmear prep (Tuesday)</h2>
          <span className="text-sm text-crust/60">{(schmear.totalSchmearOz / 16).toFixed(0)} lb total · {config.schmear.servingOz} oz/bagel</span>
        </div>
        <div className="rounded-xl bg-sesame/20 px-4 py-3">
          <div className="label">Total Philadelphia cream cheese to order</div>
          <div className="text-3xl font-extrabold">{schmear.creamCheeseTotalLb.toFixed(1)} lb</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {schmear.types.map((t) => (
            <div key={t.key} className="rounded-xl border border-crust/10 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t.name}</span>
                <span className="text-xs text-crust/50">{t.pct}% · {(t.schmearOz / 16).toFixed(1)} lb</span>
              </div>
              <table className="mt-1 w-full text-sm">
                <tbody>
                  {t.components.map((c) => (
                    <tr key={c.name}>
                      <td className="py-0.5 text-crust/70">{c.name}</td>
                      <td className="py-0.5 text-right tabular-nums">{c.grams >= 453 ? lb(c.grams) : g(c.grams)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* Starter feeding schedule */}
      <section className="card space-y-2">
        <h2 className="font-bold">Starter feeding schedule</h2>
        <p className="text-xs text-crust/50">
          Feed {config.starter.leadNights} nights before each bake day (ratio {config.starter.seed}:{config.starter.flour}:{config.starter.water}, +{config.starter.bufferPct}% buffer).
        </p>
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
              {days.map((d) => {
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
      </section>

      {/* Per-day dough */}
      <section className="card space-y-2">
        <h2 className="font-bold">Dough per day</h2>
        <p className="text-xs text-crust/50">
          {config.dough.bagelWeightG} g/bagel · ratio flour {config.dough.flour} : starter {config.dough.starter} : water {config.dough.water} : honey {config.dough.honey} : salt {config.dough.salt}.
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
