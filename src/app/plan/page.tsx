import Link from "next/link";
import { getPlanForWeek } from "@/lib/queries";
import { appToday } from "@/lib/today";
import { weekStartWednesday, addDays, isoDate, shortLabel, DOW_NAMES, OPEN_DOWS } from "@/lib/dates";
import WeekPlanner, { type PlanDto } from "./WeekPlanner";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const today = appToday();
  // The Sysco cycle: while open this week, you plan *next* week.
  const targetWed = addDays(weekStartWednesday(today), 7);
  const plan = await getPlanForWeek(targetWed);

  const dto: PlanDto | null = plan
    ? {
        id: plan.id,
        status: plan.status as PlanDto["status"],
        weekStartIso: isoDate(plan.weekStartDate),
        days: plan.days.map((d) => ({
          id: d.id,
          dateIso: isoDate(d.date),
          dow: d.dayOfWeek,
          dowName: DOW_NAMES[d.dayOfWeek],
          recommendedTotal: d.recommendedTotal,
          lines: d.lines
            .slice()
            .sort((a, b) => a.flavor.displayOrder - b.flavor.displayOrder)
            .map((l) => ({ flavorId: l.flavorId, name: l.flavor.name, planned: l.plannedQty, recommended: l.recommendedQty })),
        })),
      }
    : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Production Plan</h1>
        <p className="text-sm text-crust/60">
          Planning the week of {shortLabel(targetWed)} — pre-filled by the de-censored forecaster, editable, then lock it.
        </p>
      </header>

      <WeekPlanner weekStartIso={isoDate(targetWed)} weekLabel={shortLabel(targetWed)} plan={dto} />

      <section className="card">
        <h2 className="font-bold">Calibrate by weekday</h2>
        <p className="mb-3 text-sm text-crust/60">
          Open a weekday to see the last 8 occurrences and the reasoning behind its recommendation (PLN-1/-2/-3).
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
