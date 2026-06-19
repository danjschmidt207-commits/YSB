import Link from "next/link";
import { getPlanForWeek, getActiveFlavors } from "@/lib/queries";
import { appToday } from "@/lib/today";
import { weekStartWednesday, addDays, isoDate, shortLabel, DOW_NAMES, OPEN_DOWS } from "@/lib/dates";
import WeekPlanner, { type PlanDto } from "./WeekPlanner";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const today = appToday();
  // Plan the *next* open week (locked each Tuesday, ~8 days ahead).
  const targetWed = addDays(weekStartWednesday(today), 7);
  const [plan, flavors] = await Promise.all([getPlanForWeek(targetWed), getActiveFlavors()]);

  const dto: PlanDto | null = plan
    ? {
        id: plan.id,
        status: plan.status as PlanDto["status"],
        weekStartIso: isoDate(plan.weekStartDate),
        rotatorName: plan.rotatorName ?? "",
        days: plan.days.map((d) => ({
          id: d.id,
          dateIso: isoDate(d.date),
          dow: d.dayOfWeek,
          dowName: DOW_NAMES[d.dayOfWeek],
          recommendedTotal: d.recommendedTotal,
          plannedTotal: d.plannedTotal,
        })),
      }
    : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Production Plan</h1>
        <p className="text-sm text-crust/60">
          Planning the week of {shortLabel(targetWed)}. Set each day&apos;s total; lock by Tuesday to drive prep.
        </p>
      </header>

      <WeekPlanner
        weekStartIso={isoDate(targetWed)}
        weekLabel={shortLabel(targetWed)}
        plan={dto}
        flavors={flavors.map((f) => ({ flavorId: f.id, name: f.name, pct: f.pct }))}
      />

      <section className="card">
        <h2 className="font-bold">Calibrate by weekday</h2>
        <p className="mb-3 text-sm text-crust/60">
          Open a weekday to see the last 8 occurrences and the de-censored demand recommendation.
        </p>
        <div className="flex flex-wrap gap-2">
          {OPEN_DOWS.map((dw) => (
            <Link key={dw} href={`/plan/weekday/${dw}`} className="btn-ghost">
              {DOW_NAMES[dw]}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
