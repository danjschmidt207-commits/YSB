"use client";

import { useState, useTransition } from "react";
import { applyFlavorMixFromSquare, applySchmearMixFromSquare } from "@/app/actions";

export function ApplyMixButton({ kind, label }: { kind: "flavor" | "schmear"; label: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() =>
          start(async () => {
            const r = kind === "flavor" ? await applyFlavorMixFromSquare() : await applySchmearMixFromSquare();
            setMsg(r.ok ? "Applied ✓" : r.message ?? "Nothing to apply");
          })
        }
        disabled={pending}
        className="btn-primary !py-1.5 text-xs"
      >
        {pending ? "Applying…" : label}
      </button>
      {msg && <span className="text-xs text-crust/60">{msg}</span>}
    </div>
  );
}
