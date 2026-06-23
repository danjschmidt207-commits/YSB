"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { generatePlan, savePlanDayTotal, savePlanDayWholesale, setPlanStatus, setRotatorName } from "@/app/actions";
import { splitBagels, type FlavorPct } from "@/lib/calc";

interface DayDto {
  id: number;
  dateIso: string;
  dow: number;
  dowName: string;
  recommendedTotal: number;
  plannedTotal: number;
  wholesaleExtra: number;
}
export interface PlanDto {
  id: number;
  status: "draft" | "locked" | "ordered";
  weekStartIso: string;
  rotatorName: string;
  days: DayDto[];
}

export default function WeekPlanner({
  weekStartIso,
  weekLabel,
  plan,
  flavors,
}: {
  weekStartIso: string;
  weekLabel: string;
  plan: PlanDto | null;
  flavors: FlavorPct[];
}) {
  const [pending, start] = useTransition();
  const locked = plan?.status === "locked" || plan?.status === "ordered";

  if (!plan) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-sm text-crust/70">No plan yet for the week of {weekLabel}.</p>
        <button onClick={() => start(() => generatePlan(weekStartIso).then(() => {}))} disabled={pending} className="btn-primary mx-auto">
          {pending ? "Forecasting…" : "Generate plan from forecaster"}
        </button>
      </div>
    );
  }

  // Display flavors with the rotator's real name substituted.
  const displayFlavors: FlavorPct[] = flavors.map((f) =>
    /rotator/i.test(f.name) && plan.rotatorName ? { ...f, name: plan.rotatorName } : f
  );
  const weekRetail = plan.days.reduce((s, d) => s + d.plannedTotal, 0);
  const weekWholesale = plan.days.reduce((s, d) => s + d.wholesaleExtra, 0);
  const weekTotal = weekRetail + weekWholesale;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusPill status={plan.status} />
          <span className="text-sm text-crust/60">
            Week of {weekLabel} · {weekTotal} to bake
            {weekWholesale > 0 && <span className="text-crust/45"> ({weekRetail} retail + {weekWholesale} wholesale)</span>}
          </span>
        </div>
        <div className="flex gap-2">
          {!locked && (
            <button onClick={() => start(() => generatePlan(weekStartIso, plan.rotatorName).then(() => {}))} disabled={pending} className="btn-ghost">
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

      <RotatorField planId={plan.id} initial={plan.rotatorName} locked={locked} />

      <div className="grid gap-3 sm:grid-cols-2">
        {plan.days.map((d) => (
          <DayCard key={d.id} day={d} flavors={displayFlavors} locked={locked} />
        ))}
      </div>

      <p className="text-xs text-crust/50">
        Set each day&apos;s total — flavors split automatically by the percentages in Settings. Lock the week to drive the
        Prep calculations (dough, starter feeding, schmear).
      </p>
    </div>
  );
}

function RotatorField({ planId, initial, locked }: { planId: number; initial: string; locked: boolean }) {
  const [name, setName] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <div className="card flex flex-wrap items-center gap-2">
      <span className="label">This week&apos;s rotator</span>
      <input
        value={name}
        disabled={locked}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== initial && start(() => setRotatorName(planId, name).then(() => {}))}
        placeholder="e.g. Jalapeño Cheddar"
        className="flex-1 rounded-lg border border-crust/20 px-3 py-1.5 text-sm disabled:bg-crust/5"
      />
      {pending && <span className="text-xs text-crust/50">saving…</span>}
    </div>
  );
}

function DayCard({ day, flavors, locked }: { day: DayDto; flavors: FlavorPct[]; locked: boolean }) {
  const [total, setTotal] = useState(day.plannedTotal);
  const [wholesale, setWholesale] = useState(day.wholesaleExtra);
  const [pending, start] = useTransition();
  const bakeTotal = total + wholesale;
  // Retail + wholesale are baked together, so the flavor split covers the full bake.
  const split = splitBagels(bakeTotal, flavors);
  const delta = total - day.recommendedTotal;

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <Link href={`/plan/weekday/${day.dow}`} className="font-bold underline-offset-2 hover:underline">
          {day.dowName}
        </Link>
        <span className="text-xs text-crust/50">{day.dateIso.slice(5)}</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          disabled={locked}
          value={total}
          onChange={(e) => setTotal(Math.max(0, parseInt(e.target.value || "0", 10)))}
          onBlur={() => total !== day.plannedTotal && start(() => savePlanDayTotal(day.id, total).then(() => {}))}
          className="h-11 w-24 rounded-lg border border-crust/20 text-center text-xl font-bold tabular-nums disabled:bg-crust/5"
        />
        <div className="text-xs text-crust/50">
          retail bagels
          <div className={delta === 0 ? "text-crust/40" : delta > 0 ? "text-amber-600" : "text-blue-600"}>
            {delta === 0 ? "= forecast" : `${delta > 0 ? "+" : ""}${delta} vs ${day.recommendedTotal}`}
          </div>
        </div>
        {pending && <span className="text-xs text-crust/40">…</span>}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          disabled={locked}
          value={wholesale}
          onChange={(e) => setWholesale(Math.max(0, parseInt(e.target.value || "0", 10)))}
          onBlur={() => wholesale !== day.wholesaleExtra && start(() => savePlanDayWholesale(day.id, wholesale).then(() => {}))}
          className="h-9 w-20 rounded-lg border border-crust/20 text-center text-base font-semibold tabular-nums disabled:bg-crust/5"
        />
        <div className="text-xs text-crust/50">
          + wholesale extra
          <div className="font-semibold text-crust/70">bake {bakeTotal} total</div>
        </div>
      </div>

      <div className="border-t border-crust/10 pt-1 text-sm">
        <div className="mb-0.5 text-xs font-medium text-crust/45">
          Flavor split{wholesale > 0 ? ` (${bakeTotal} incl. wholesale)` : ""}
        </div>
        {split.map((s) => (
          <div key={s.flavorId} className="flex justify-between text-crust/70">
            <span>{s.name}</span>
            <span className="tabular-nums">{s.qty}</span>
          </div>
        ))}
      </div>
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
