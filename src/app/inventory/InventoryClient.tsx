"use client";

import { useState, useTransition } from "react";
import { updateIngredient } from "@/app/actions";

export interface IngredientDto {
  id: number;
  name: string;
  unit: string;
  currentStock: number;
  parLevel: number;
  reorderPoint: number;
}

export function StockRow({ ing }: { ing: IngredientDto }) {
  const [stock, setStock] = useState(ing.currentStock);
  const [par, setPar] = useState(ing.parLevel);
  const [reorder, setReorder] = useState(ing.reorderPoint);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const dirty = stock !== ing.currentStock || par !== ing.parLevel || reorder !== ing.reorderPoint;
  const low = stock <= ing.reorderPoint;

  return (
    <div className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 border-t border-crust/5 px-3 py-2 ${low ? "bg-red-50/50" : ""}`}>
      <div>
        <div className="text-sm font-semibold">{ing.name}</div>
        <div className="text-xs text-crust/50">
          {ing.unit}
          {low && <span className="pill ml-2 bg-red-100 text-red-700">reorder</span>}
        </div>
      </div>
      <NumCell label="have" value={stock} onChange={(v) => { setStock(v); setSaved(false); }} />
      <NumCell label="par" value={par} onChange={(v) => { setPar(v); setSaved(false); }} />
      <NumCell label="reorder at" value={reorder} onChange={(v) => { setReorder(v); setSaved(false); }} />
      <button
        onClick={() => start(() => updateIngredient(ing.id, { currentStock: stock, parLevel: par, reorderPoint: reorder }).then(() => setSaved(true)))}
        disabled={!dirty || pending}
        className="btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-30"
      >
        {pending ? "…" : saved && !dirty ? "✓" : "Save"}
      </button>
    </div>
  );
}

function NumCell({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col items-center">
      <span className="text-[10px] uppercase tracking-wide text-crust/40">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
        className="h-9 w-16 rounded-lg border border-crust/20 text-center text-sm tabular-nums"
      />
    </label>
  );
}
