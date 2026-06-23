"use client";

import { useState, useTransition } from "react";
import { importSquareSales, setSquareOverride, ignoreSquareModifiers } from "@/app/actions";

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function SquareSection({
  configured,
  env,
  flavors,
  schmears,
  initialUnmapped,
  diag,
}: {
  configured: boolean;
  env: string;
  flavors: { id: number; name: string }[];
  schmears: { key: string; name: string }[];
  initialUnmapped: string[];
  diag: string | null;
}) {
  const [from, setFrom] = useState(isoDaysAgo(56));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [unmapped, setUnmapped] = useState<string[]>(initialUnmapped);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-crust/60">
          {configured ? "Token detected — pulling live orders." : "No token set — using sample data for now."}
        </span>
        <span className={`pill ${configured ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{env}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-crust/20 px-3 py-2" />
        </label>
        <label className="block">
          <span className="label">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-crust/20 px-3 py-2" />
        </label>
      </div>

      <button
        onClick={() =>
          start(async () => {
            const r = await importSquareSales(from, to);
            setUnmapped(r.unmapped);
            setResult(`Imported ${r.imported.toLocaleString()} bagel/schmear lines from ${r.source}.${r.unmapped.length ? ` ${r.unmapped.length} option(s) need mapping below.` : " All mapped."}`);
          })
        }
        disabled={pending}
        className="btn-primary w-full"
      >
        {pending ? "Importing…" : "Import Square sales"}
      </button>
      {result && <p className="text-sm text-crust/70">{result}</p>}

      {unmapped.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-amber-800">Map these Square options, then re-import to apply:</p>
            <button
              onClick={() => start(() => ignoreSquareModifiers(unmapped).then(() => setUnmapped([])))}
              disabled={pending}
              className="btn-ghost !px-2 !py-1 text-xs"
            >
              Ignore the rest
            </button>
          </div>
          {unmapped.map((name) => (
            <UnmappedRow
              key={name}
              name={name}
              flavors={flavors}
              schmears={schmears}
              onDone={() => setUnmapped((u) => u.filter((x) => x !== name))}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-crust/50">
        Reads the flavor/schmear from each line&apos;s modifiers. Map all your past rotator flavors to <strong>Rotator</strong>,
        weekly rotating schmears to <strong>Rotator Schmear</strong>, and ignore unrelated options (coffee, etc.). Re-import after mapping.
        Each import <strong>replaces all previously imported Square sales</strong> with the range you select, so pick the full window you want to analyze.
      </p>

      {diag && (
        <details className="rounded-xl border border-crust/15 bg-crust/[0.03] p-3 text-xs">
          <summary className="cursor-pointer font-medium text-crust/70">Import diagnostics (how Square structured the data)</summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-crust/70">
{JSON.stringify(JSON.parse(diag), null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function UnmappedRow({
  name,
  flavors,
  schmears,
  onDone,
}: {
  name: string;
  flavors: { id: number; name: string }[];
  schmears: { key: string; name: string }[];
  onDone: () => void;
}) {
  const [val, setVal] = useState("");
  const [pending, start] = useTransition();

  function save() {
    const value = val === "ignore" ? "ignore" : val.startsWith("schmear:") ? val : Number(val);
    start(() => setSquareOverride(name, value).then(onDone));
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 truncate text-sm font-mono text-crust/70">{name}</span>
      <select value={val} onChange={(e) => setVal(e.target.value)} className="rounded-lg border border-crust/20 px-2 py-1.5 text-sm">
        <option value="">Map to…</option>
        <optgroup label="Bagel flavor">
          {flavors.map((f) => (
            <option key={f.id} value={String(f.id)}>{f.name}</option>
          ))}
        </optgroup>
        <optgroup label="Schmear">
          {schmears.map((s) => (
            <option key={s.key} value={`schmear:${s.key}`}>{s.name}</option>
          ))}
        </optgroup>
        <option value="ignore">Ignore (not a bagel/schmear)</option>
      </select>
      <button onClick={save} disabled={!val || pending} className="btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-40">
        {pending ? "…" : "Save"}
      </button>
    </div>
  );
}
