"use client";

import { useState, useTransition } from "react";
import { updateFlavor, updateFlavorPct, updateSetting, clearSampleData, resetToDefaults } from "@/app/actions";
import type { DoughRecipe, StarterConfig, SchmearConfig } from "@/lib/config";

function Field({ label, value, onChange, step = "any", width = "w-20" }: { label: string; value: number; onChange: (v: number) => void; step?: string; width?: string }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="text-crust/70">{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value || "0"))} className={`h-9 ${width} rounded-lg border border-crust/20 text-center tabular-nums`} />
    </label>
  );
}

function SaveBtn({ onClick, pending, saved }: { onClick: () => void; pending: boolean; saved: boolean }) {
  return (
    <button onClick={onClick} disabled={pending} className="btn-ghost mt-2 w-full !py-1.5 text-xs">
      {pending ? "Saving…" : saved ? "Saved ✓" : "Save"}
    </button>
  );
}

export function FlavorRow({ flavor }: { flavor: { id: number; name: string; active: boolean; pct: number; isRotator: boolean } }) {
  const [name, setName] = useState(flavor.name);
  const [active, setActive] = useState(flavor.active);
  const [pct, setPct] = useState(flavor.pct);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const dirty = name !== flavor.name || active !== flavor.active || pct !== flavor.pct;

  return (
    <div className="flex items-center gap-2 py-1">
      <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} className="flex-1 rounded-lg border border-crust/20 px-3 py-1.5 text-sm" />
      <input type="number" step="1" value={pct} onChange={(e) => { setPct(parseFloat(e.target.value || "0")); setSaved(false); }} className="h-9 w-16 rounded-lg border border-crust/20 text-center text-sm tabular-nums" title="percent of daily bake" />
      <span className="text-xs text-crust/40">%</span>
      <label className="flex items-center gap-1 text-xs text-crust/60">
        <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked); setSaved(false); }} /> on
      </label>
      <button
        onClick={() => start(async () => { await updateFlavor(flavor.id, name, active); await updateFlavorPct(flavor.id, pct); setSaved(true); })}
        disabled={!dirty || pending}
        className="btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-40"
      >
        {pending ? "…" : saved && !dirty ? "✓" : "Save"}
      </button>
    </div>
  );
}

export function NumberSetting({ settingKey, label, value, step = "1", hint }: { settingKey: string; label: string; value: string; step?: string; hint?: string }) {
  const [val, setVal] = useState(value);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-crust/50">{hint}</div>}
      </div>
      <div className="flex items-center gap-2">
        <input type="text" value={val} onChange={(e) => { setVal(e.target.value); setSaved(false); }} className="h-9 w-24 rounded-lg border border-crust/20 text-center tabular-nums" />
        <button onClick={() => start(() => updateSetting(settingKey, val).then(() => setSaved(true)))} disabled={pending} className="btn-ghost !px-3 !py-1.5 text-xs">
          {pending ? "…" : saved ? "✓" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function DoughEditor({ initial }: { initial: DoughRecipe }) {
  const [d, setD] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const set = (k: keyof DoughRecipe, v: number) => { setD((x) => ({ ...x, [k]: v })); setSaved(false); };
  return (
    <div>
      <Field label="Flour (parts)" value={d.flour} onChange={(v) => set("flour", v)} />
      <Field label="Starter (parts)" value={d.starter} onChange={(v) => set("starter", v)} />
      <Field label="Water (parts)" value={d.water} onChange={(v) => set("water", v)} />
      <Field label="Honey (parts)" value={d.honey} onChange={(v) => set("honey", v)} />
      <Field label="Salt (parts)" value={d.salt} onChange={(v) => set("salt", v)} />
      <Field label="Bagel weight (g)" value={d.bagelWeightG} onChange={(v) => set("bagelWeightG", v)} />
      <SaveBtn pending={pending} saved={saved} onClick={() => start(() => updateSetting("dough_recipe", JSON.stringify(d)).then(() => setSaved(true)))} />
    </div>
  );
}

export function StarterEditor({ initial }: { initial: StarterConfig }) {
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const set = (k: keyof StarterConfig, v: number) => { setS((x) => ({ ...x, [k]: v })); setSaved(false); };
  return (
    <div>
      <Field label="Feed ratio — starter" value={s.seed} onChange={(v) => set("seed", v)} />
      <Field label="Feed ratio — flour" value={s.flour} onChange={(v) => set("flour", v)} />
      <Field label="Feed ratio — water" value={s.water} onChange={(v) => set("water", v)} />
      <Field label="Buffer (%)" value={s.bufferPct} onChange={(v) => set("bufferPct", v)} />
      <Field label="Feed nights before bake" value={s.leadNights} onChange={(v) => set("leadNights", v)} />
      <SaveBtn pending={pending} saved={saved} onClick={() => start(() => updateSetting("starter_feed", JSON.stringify(s)).then(() => setSaved(true)))} />
    </div>
  );
}

export function SchmearEditor({ initial }: { initial: SchmearConfig }) {
  const [serving, setServing] = useState(initial.servingOz);
  const [pcts, setPcts] = useState(initial.types.map((t) => t.pct));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const total = pcts.reduce((s, p) => s + p, 0);
  return (
    <div>
      <Field label="Serving (oz/bagel)" value={serving} onChange={(v) => { setServing(v); setSaved(false); }} />
      {initial.types.map((t, i) => (
        <Field key={t.key} label={`${t.name} (%)`} value={pcts[i]} onChange={(v) => { setPcts((p) => p.map((x, j) => (j === i ? v : x))); setSaved(false); }} />
      ))}
      <div className={`text-xs ${total === 100 ? "text-crust/40" : "text-amber-600"}`}>sum: {total}%</div>
      <SaveBtn pending={pending} saved={saved} onClick={() => start(() => {
        const cfg: SchmearConfig = { servingOz: serving, types: initial.types.map((t, i) => ({ ...t, pct: pcts[i] })) };
        return updateSetting("schmear_config", JSON.stringify(cfg)).then(() => setSaved(true));
      })} />
    </div>
  );
}

export function DangerButtons() {
  const [mode, setMode] = useState<null | "clear" | "reset">(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (msg) return <p className="text-sm text-green-700">{msg}</p>;

  if (mode) {
    const isReset = mode === "reset";
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-700">
          {isReset
            ? "Reset flavors, recipes, and settings to defaults AND delete all bake history + plans. Use this once to switch an older database to the new model. Cannot be undone."
            : "Delete all bake history and plans (keeps flavors, recipes, settings). Cannot be undone."}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => start(async () => { const r = isReset ? await resetToDefaults() : await clearSampleData(); setMsg(isReset ? "Reset to defaults." : `Cleared ${(r as any).removed ?? 0} records.`); })}
            disabled={pending}
            className="btn bg-red-600 text-white hover:bg-red-700"
          >
            {pending ? "Working…" : isReset ? "Yes, reset everything" : "Yes, delete history"}
          </button>
          <button onClick={() => setMode(null)} disabled={pending} className="btn-ghost">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => setMode("clear")} className="btn-ghost border-red-300 text-red-700 hover:bg-red-50">Clear bake history</button>
      <button onClick={() => setMode("reset")} className="btn-ghost border-red-300 text-red-700 hover:bg-red-50">Reset to defaults</button>
    </div>
  );
}
