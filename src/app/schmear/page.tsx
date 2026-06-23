import Link from "next/link";
import { loadWeekPrep } from "@/lib/prepData";
import { shortLabel } from "@/lib/dates";
import { g, lb } from "@/lib/calc";

export const dynamic = "force-dynamic";

export default async function SchmearPage() {
  const { targetWed, config, prep } = await loadWeekPrep();

  if (!prep) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Schmear</h1>
        <div className="card">
          No plan yet for the week of {shortLabel(targetWed)}.{" "}
          <Link href="/plan" className="underline">Create one in Plan</Link> — schmear amounts come from the week&apos;s retail totals.
        </div>
      </div>
    );
  }

  const { schmear } = prep;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Schmear prep</h1>
          <p className="text-sm text-crust/60">
            Tuesday · week of {shortLabel(targetWed)} · {prep.weeklyRetail} retail bagels · {config.schmear.servingOz} oz/bagel
          </p>
        </div>
        <Link href="/plan" className="text-sm text-crust/60 underline">Edit plan →</Link>
      </header>

      <div className="rounded-xl bg-sesame/20 px-4 py-3">
        <div className="label">Total Philadelphia cream cheese to order</div>
        <div className="text-3xl font-extrabold">{schmear.creamCheeseTotalBlocks} blocks</div>
        <div className="text-xs text-crust/50">{schmear.creamCheeseTotalLb.toFixed(0)} lb · whole 3-lb blocks · {(schmear.totalSchmearOz / 16).toFixed(0)} lb schmear total</div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {schmear.types.map((t) => (
          <div key={t.key} className="card">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{t.name}</span>
              <span className="text-xs text-crust/50">{t.pct}% · {(t.schmearOz / 16).toFixed(1)} lb</span>
            </div>
            <table className="mt-1 w-full text-sm">
              <tbody>
                {t.components.map((c) => {
                  const isCC = /cream cheese/i.test(c.name);
                  return (
                    <tr key={c.name}>
                      <td className="py-0.5 text-crust/70">{c.name}</td>
                      <td className="py-0.5 text-right tabular-nums">
                        {isCC ? `${t.creamCheeseBlocks} blocks (${lb(c.grams)})` : c.grams >= 453 ? lb(c.grams) : g(c.grams)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}
