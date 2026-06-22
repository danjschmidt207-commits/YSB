"use client";

import { useState, useTransition } from "react";
import { importSquareSales, setSquareOverride } from "@/app/actions";

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function SquareSection({
  configured,
  env,
  flavors,
  initialUnmapped,
}: {
  configured: boolean;
  env: string;
  flavors: { id: number; name: string }[];
  initialUnmapped: string[];
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
            setResult(`Imported ${r.imported.toLocaleString()} lines from ${r.source}.${r.unmapped.length ? ` ${r.unmapped.length} modifier(s) need mapping below.` : " All mapped."}`);
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
          <p className="text-sm font-medium text-amber-800">Map these Square options, then re-import to apply:</p>
          {unmapped.map((name) => (
            <UnmappedRow key={name} name={name} flavors={flavors} />
          ))}
        </div>
      )}

      <p className="text-xs text-crust/50">
        Imports completed orders and reads the flavor/schmear from each line&apos;s modifiers. Run it again after mapping,
        or whenever you want fresh data. See <a className="underline" href="https://developer.squareup.com/docs/orders-api/what-it-does" target="_blank" rel="noreferrer">Square Orders API</a>.
      </p>
    </div>
  );
}

function UnmappedRow({ name, flavors }: { name: string; flavors: { id: number; name: string }[] }) {
  const [val, setVal] = useState("");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-sm font-mono text-crust/70">{name}</span>
      <select value={val} onChange={(e) => { setVal(e.target.value); setSaved(false); }} className="rounded-lg border border-crust/20 px-2 py-1.5 text-sm">
        <option value="">Map to…</option>
        {flavors.map((f) => (
          <option key={f.id} value={String(f.id)}>{f.name}</option>
        ))}
        <option value="ignore">Ignore</option>
      </select>
      <button
        onClick={() => start(() => setSquareOverride(name, val === "ignore" ? "ignore" : Number(val)).then(() => setSaved(true)))}
        disabled={!val || pending}
        className="btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-40"
      >
        {pending ? "…" : saved ? "✓" : "Save"}
      </button>
    </div>
  );
}
