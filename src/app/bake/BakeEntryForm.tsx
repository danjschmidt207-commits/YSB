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
    baked: Record<number, number>;
  };
}) {
  const [baked, setBaked] = useState<Record<number, number>>(initial.baked);
  const [openTime, setOpenTime] = useState(initial.openTime);
  const [closeTime, setCloseTime] = useState(initial.closeTime);
  const [notes, setNotes] = useState(initial.notes);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const total = flavors.reduce((s, f) => s + (baked[f.id] || 0), 0);

  function setQty(id: number, v: number) {
    setSaved(false);
    setBaked((b) => ({ ...b, [id]: Math.max(0, v) }));
  }

  function submit() {
    start(async () => {
      await saveBake({
        dateIso,
        openTime,
        closeTime,
        notes,
        lines: flavors.map((f) => ({ flavorId: f.id, baked: baked[f.id] || 0 })),
      });
      setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {flavors.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-xl border border-crust/10 bg-white p-3">
            <span className="font-semibold">{f.name}</span>
            <Stepper value={baked[f.id] || 0} onChange={(v) => setQty(f.id, v)} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-crust px-4 py-3 text-sesame">
        <span className="font-semibold">Total baked</span>
        <span className="text-2xl font-bold tabular-nums">{total}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Open</span>
          <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="mt-1 w-full rounded-lg border border-crust/20 px-3 py-2" />
        </label>
        <label className="block">
          <span className="label">Close</span>
          <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="mt-1 w-full rounded-lg border border-crust/20 px-3 py-2" />
        </label>
      </div>

      <label className="block">
        <span className="label">Notes (weather, events, closures)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-crust/20 px-3 py-2" placeholder="e.g. road closure on Main; rainy" />
      </label>

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={pending} className="btn-primary flex-1 py-3 text-base">
          {pending ? "Saving…" : "Save bake"}
        </button>
        {saved && <span className="pill bg-green-100 text-green-700">Saved ✓</span>}
      </div>
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(value - 1)} className="h-11 w-11 rounded-full border border-crust/20 text-xl font-bold active:scale-95" aria-label="decrease">
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
        className="h-11 w-16 rounded-lg border border-crust/20 text-center text-lg font-bold tabular-nums"
      />
      <button onClick={() => onChange(value + 1)} className="h-11 w-11 rounded-full border border-crust/20 text-xl font-bold active:scale-95" aria-label="increase">
        +
      </button>
    </div>
  );
}
