"use client";

import { useState, useTransition } from "react";
import { updateFlavor, updateSetting } from "@/app/actions";

export function FlavorRow({ flavor }: { flavor: { id: number; name: string; active: boolean } }) {
  const [name, setName] = useState(flavor.name);
  const [active, setActive] = useState(flavor.active);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const dirty = name !== flavor.name || active !== flavor.active;

  return (
    <div className="flex items-center gap-2 py-1">
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaved(false);
        }}
        className="flex-1 rounded-lg border border-crust/20 px-3 py-1.5 text-sm"
      />
      <label className="flex items-center gap-1 text-xs text-crust/60">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => {
            setActive(e.target.checked);
            setSaved(false);
          }}
        />
        active
      </label>
      <button
        onClick={() => start(() => updateFlavor(flavor.id, name, active).then(() => setSaved(true)))}
        disabled={!dirty || pending}
        className="btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-40"
      >
        {pending ? "…" : saved && !dirty ? "✓" : "Save"}
      </button>
    </div>
  );
}

export function NumberSetting({
  settingKey,
  label,
  value,
  step = "1",
  suffix,
  hint,
}: {
  settingKey: string;
  label: string;
  value: string;
  step?: string;
  suffix?: string;
  hint?: string;
}) {
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
        <input
          type="number"
          step={step}
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setSaved(false);
          }}
          className="h-9 w-20 rounded-lg border border-crust/20 text-center tabular-nums"
        />
        {suffix && <span className="text-xs text-crust/50">{suffix}</span>}
        <button
          onClick={() => start(() => updateSetting(settingKey, val).then(() => setSaved(true)))}
          disabled={val === value && !saved ? true : pending}
          className="btn-ghost !px-3 !py-1.5 text-xs"
        >
          {pending ? "…" : saved && val === val ? "Save" : "Save"}
        </button>
      </div>
    </div>
  );
}
