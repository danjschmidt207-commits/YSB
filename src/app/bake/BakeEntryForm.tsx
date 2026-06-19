"use client";

import { useState, useTransition } from "react";
import { saveBake } from "@/app/actions";

interface FlavorLite {
  id: number;
  name: string;
}

export default function BakeEntryForm({
  dateIso,
  flavors,
  initial,
}: {
  dateIso: string;
  flavors: FlavorLite[];
  initial: {
    openTime: string;
    closeTime: string;
    notes: string;
    soldOut: boolean;
    soldOutTime: string;
    baked: Record<number, number>;
    leftover: Record<number, number>;
  };
}) {
  const [baked, setBaked] = useState<Record<number, number>>(initial.baked);
  const [leftover, setLeftover] = useState<Record<number, number>>(initial.leftover);
  const [openTime, setOpenTime] = useState(initial.openTime);
  const [closeTime, setCloseTime] = useState(initial.closeTime);
  const [notes, setNotes] = useState(initial.notes);
  const [soldOut, setSoldOut] = useState(initial.soldOut);
  const [soldOutTime, setSoldOutTime] = useState(initial.soldOutTime);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const totalBaked = flavors.reduce((s, f) => s + (baked[f.id] || 0), 0);
  const totalSold = flavors.reduce((s, f) => s + Math.max(0, (baked[f.id] || 0) - (leftover[f.id] || 0)), 0);

  function set(map: "b" | "l", id: number, v: number) {
    setSaved(false);
    const setter = map === "b" ? setBaked : setLeftover;
    setter((m) => ({ ...m, [id]: Math.max(0, v) }));
  }

  function submit() {
    start(async () => {
      await saveBake({
        dateIso,
        openTime,
        closeTime,
        notes,
        soldOut,
        soldOutTime,
        lines: flavors.map((f) => ({ flavorId: f.id, baked: baked[f.id] || 0, leftover: leftover[f.id] || 0 })),
      });
      setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-crust/10">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-crust/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-crust/50">
          <span>Flavor</span>
          <span className="w-24 text-center">Baked</span>
          <span className="w-20 text-center">Left</span>
        </div>
        {flavors.map((f) => {
          const sold = Math.max(0, (baked[f.id] || 0) - (leftover[f.id] || 0));
          return (
            <div key={f.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-crust/5 px-3 py-2">
              <div>
                <div className="font-semibold">{f.name}</div>
                <div className="text-xs text-crust/50">sold {sold}</div>
              </div>
              <input
                type="number"
                inputMode="numeric"
                value={baked[f.id] || 0}
                onChange={(e) => set("b", f.id, parseInt(e.target.value || "0", 10))}
                className="h-10 w-24 rounded-lg border border-crust/20 text-center text-lg font-bold tabular-nums"
              />
              <input
                type="number"
                inputMode="numeric"
                value={leftover[f.id] || 0}
                onChange={(e) => set("l", f.id, parseInt(e.target.value || "0", 10))}
                className="h-10 w-20 rounded-lg border border-crust/20 text-center tabular-nums"
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-crust px-4 py-3 text-sesame">
        <span className="font-semibold">Baked {totalBaked}</span>
        <span className="font-semibold">Sold {totalSold}</span>
        <span className="font-semibold">Left {totalBaked - totalSold}</span>
      </div>

      <div className="rounded-xl border border-crust/10 p-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={soldOut} onChange={(e) => { setSoldOut(e.target.checked); setSaved(false); }} />
          Sold out
        </label>
        {soldOut && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-crust/60">Time sold out</span>
            <input type="time" value={soldOutTime} onChange={(e) => { setSoldOutTime(e.target.value); setSaved(false); }} className="rounded-lg border border-crust/20 px-2 py-1" />
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Open</span>
          <input type="time" value={openTime} onChange={(e) => { setOpenTime(e.target.value); setSaved(false); }} className="mt-1 w-full rounded-lg border border-crust/20 px-3 py-2" />
        </label>
        <label className="block">
          <span className="label">Close</span>
          <input type="time" value={closeTime} onChange={(e) => { setCloseTime(e.target.value); setSaved(false); }} className="mt-1 w-full rounded-lg border border-crust/20 px-3 py-2" />
        </label>
      </div>

      <label className="block">
        <span className="label">Notes (weather, events, closures)</span>
        <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} rows={2} className="mt-1 w-full rounded-lg border border-crust/20 px-3 py-2" />
      </label>

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={pending} className="btn-primary flex-1 py-3 text-base">
          {pending ? "Saving…" : "Save day"}
        </button>
        {saved && <span className="pill bg-green-100 text-green-700">Saved ✓</span>}
      </div>
    </div>
  );
}
