import Link from "next/link";
import { prisma } from "@/lib/db";
import { loadWeekPrep } from "@/lib/prepData";
import { shortLabel, isoDate, addDays, DOW_NAMES, DOW_SHORT } from "@/lib/dates";
import { StarterRows, type StarterDay } from "./StarterClient";

export const dynamic = "force-dynamic";

export default async function StarterPage() {
  const [{ targetWed, config, prep }, ratioRow] = await Promise.all([
    loadWeekPrep(),
    prisma.appSetting.findUnique({ where: { key: "starter_ratio_by_dow" } }),
  ]);

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

  const overrides: Record<string, { seed: number; flour: number; water: number }> = ratioRow ? JSON.parse(ratioRow.value) : {};

  const days: StarterDay[] = prep.days.map((d) => {
    const feedNight = addDays(d.date, -config.starter.leadNights);
    const ratio = overrides[String(d.dow)] ?? {
      seed: config.starter.seed,
      flour: config.starter.flour,
      water: config.starter.water,
    };
    return {
      dow: d.dow,
      feedNightLabel: DOW_NAMES[feedNight.getUTCDay()],
      bakeLabel: `${DOW_SHORT[d.dow]} ${isoDate(d.date).slice(5)}`,
      neededG: d.starter.neededG,
      bufferPct: config.starter.bufferPct,
      ratio,
    };
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Starter feeding</h1>
          <p className="text-sm text-crust/60">
            Week of {shortLabel(targetWed)} · feed {config.starter.leadNights} nights ahead · +{config.starter.bufferPct}% buffer
          </p>
        </div>
        <Link href="/dough" className="text-sm text-crust/60 underline">Dough →</Link>
      </header>

      <p className="text-xs text-crust/50">
        Feed ratio defaults to {config.starter.seed}:{config.starter.flour}:{config.starter.water} (seed:flour:water) — adjust it per day below.
        &quot;Build&quot; is the total starter to make that night; it splits into seed/flour/water by the ratio.
      </p>

      <StarterRows days={days} />
    </div>
  );
}
