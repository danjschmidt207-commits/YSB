"use client";

import { useState, useTransition } from "react";
import { saveStarterRatio } from "@/app/actions";
import { g } from "@/lib/calc";

export interface StarterDay {
  dow: number;
  feedNightLabel: string;
  bakeLabel: string;
  neededG: number; // starter the dough needs (before buffer)
  bufferPct: number;
  ratio: { seed: number; flour: number; water: number };
}

export function StarterRows({ days }: { days: StarterDay[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {days.map((d) => (
        <StarterRow key={d.dow} day={d} />
      ))}
    </div>
  );
}

function StarterRow({ day }: { day: StarterDay }) {
  const [seed, setSeed] = useState(day.ratio.seed);
  const [flour, setFlour] = useState(day.ratio.flour);
  const [water, setWater] = useState(day.ratio.water);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty = seed !== day.ratio.seed || flour !== day.ratio.flour || water !== day.ratio.water;
  const sum = seed + flour + water || 1;
  const build = day.neededG * (1 + day.bufferPct / 100);
  const seedG = (build * seed) / sum;
  const flourG = (build * flour) / sum;
  const waterG = (build * water) / sum;

  const num = (v: number, set: (n: number) => void) => (
    <input
      type="number"
      step="any"
      value={v}
      onChange={(e) => { set(parseFloat(e.target.value || "0")); setSaved(false); }}
      className="h-9 w-14 rounded-lg border border-crust/20 text-center tabular-nums"
    />
  );

  return (
    <div className="card space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="font-bold">{day.feedNightLabel} night</span>
        <span className="text-xs text-crust/50">for {day.bakeLabel}</span>
      </div>

      <div className="flex items-center gap-1 text-sm">
        <span className="text-crust/60">Feed ratio</span>
        {num(seed, setSeed)}<span className="text-crust/40">:</span>
        {num(flour, setFlour)}<span className="text-crust/40">:</span>
        {num(water, setWater)}
        <span className="ml-1 text-xs text-crust/40">seed:flour:water</span>
      </div>

      <div className="rounded-xl bg-amber-100/50 px-3 py-2 text-sm text-amber-900">
        <div className="font-semibold">Build {g(build)}</div>
        <div className="text-xs">starter {g(seedG)} · flour {g(flourG)} · water {g(waterG)}</div>
      </div>

      <button
        onClick={() => start(() => saveStarterRatio(day.dow, { seed, flour, water }).then(() => setSaved(true)))}
        disabled={!dirty || pending}
        className="btn-ghost w-full !py-1.5 text-xs disabled:opacity-40"
      >
        {pending ? "Saving…" : saved && !dirty ? "Saved ✓" : "Save ratio for this day"}
      </button>
    </div>
  );
}
