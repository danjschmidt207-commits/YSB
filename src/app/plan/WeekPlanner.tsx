"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { generatePlan, savePlanDay, setPlanStatus } from "@/app/actions";

interface LineDto {
  flavorId: number;
  name: string;
  planned: number;
  recommended: number;
}
interface DayDto {
  id: number;
  dateIso: string;
  dow: number;
  dowName: string;
  recommendedTotal: number;
  lines: LineDto[];
}
export interface PlanDto {
  id: number;
  status: "draft" | "locked" | "ordered";
  weekStartIso: string;
  days: DayDto[];
}

export default function WeekPlanner({
  weekStartIso,
  weekLabel,
  plan,
}: {
  weekStartIso: string;
  weekLabel: string;
  plan: PlanDto | null;
}) {
  const [pending, start] = useTransition();
  const locked = plan?.status === "locked" || plan?.status === "ordered";

  if (!plan) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-sm text-crust/70">No plan yet for the week of {weekLabel}.</p>
        <button
          onClick={() => start(() => generatePlan(weekStartIso).then(() => {}))}
          disabled={pending}
          className="btn-primary mx-auto"
        >
          {pending ? "Forecasting…" : "Generate plan from forecaster"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusPill status={plan.status} />
          <span className="text-sm text-crust/60">Week of {weekLabel}</span>
        </div>
        <div className="flex gap-2">
          {!locked && (
            <button
              onClick={() => start(() => generatePlan(weekStartIso).then(() => {}))}
              disabled={pending}
              className="btn-ghost"
            >
              ↻ Re-forecast
            </button>
          )}
          {plan.status === "draft" ? (
            <button onClick={() => start(() => setPlanStatus(plan.id, "locked").then(() => {}))} disabled={pending} className="btn-primary">
              🔒 Lock week
            </button>
          ) : plan.status === "locked" ? (
            <button onClick={() => start(() => setPlanStatus(plan.id, "draft").then(() => {}))} disabled={pending} className="btn-ghost">
              Unlock
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {plan.days.map((d) => (
          <DayCard key={d.id} day={d} locked={locked} />
        ))}
      </div>

      <p className="text-xs text-crust/50">
        Locking the week feeds the recipe/prep and Sysco-order modules (Phase 2). Both recommended and
        planned numbers are stored, so forecast accuracy can be measured later (PLN-6).
      </p>
    </div>
  );
}

function DayCard({ day, locked }: { day: DayDto; locked: boolean }) {
  const [lines, setLines] = useState<LineDto[]>(day.lines);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const total = lines.reduce((s, l) => s + (l.planned || 0), 0);
  const delta = total - day.recommendedTotal;

  function set(flavorId: number, v: number) {
    setDirty(true);
    setLines((ls) => ls.map((l) => (l.flavorId === flavorId ? { ...l, planned: Math.max(0, v) } : l)));
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <Link href={`/plan/weekday/${day.dow}`} className="font-bold underline-offset-2 hover:underline">
          {day.dowName}
        </Link>
        <span className="text-xs text-crust/50">{day.dateIso.slice(5)}</span>
      </div>

      <div className="space-y-1">
        {lines.map((l) => (
          <div key={l.flavorId} className="flex items-center justify-between text-sm">
            <span className="text-crust/80">{l.name}</span>
            <div className="flex items-center gap-2">
              <span className="w-8 text-right text-xs text-crust/40" title="recommended">
                {l.recommended}
              </span>
              <input
                type="number"
                inputMode="numeric"
                disabled={locked}
                value={l.planned}
                onChange={(e) => set(l.flavorId, parseInt(e.target.value || "0", 10))}
                className="h-9 w-16 rounded-lg border border-crust/20 text-center tabular-nums disabled:bg-crust/5"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-crust/10 pt-2">
        <span className="label">Total</span>
        <span className="text-lg font-bold tabular-nums">
          {total}
          <span className={`ml-2 text-xs font-medium ${delta === 0 ? "text-crust/40" : delta > 0 ? "text-amber-600" : "text-blue-600"}`}>
            {delta === 0 ? "= rec" : `${delta > 0 ? "+" : ""}${delta} vs rec ${day.recommendedTotal}`}
          </span>
        </span>
      </div>

      {!locked && dirty && (
        <button
          onClick={() =>
            start(() =>
              savePlanDay(
                day.id,
                lines.map((l) => ({ flavorId: l.flavorId, planned: l.planned }))
              ).then(() => setDirty(false))
            )
          }
          disabled={pending}
          className="btn-ghost w-full !py-1.5 text-xs"
        >
          {pending ? "Saving…" : "Save day"}
        </button>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-amber-100 text-amber-700",
    locked: "bg-green-100 text-green-700",
    ordered: "bg-blue-100 text-blue-700",
  };
  return <span className={`pill ${map[status] ?? "bg-crust/10"}`}>{status}</span>;
}
