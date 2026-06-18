"use client";

import { useState, useTransition } from "react";
import { refreshSales } from "@/app/actions";

export default function RefreshSalesButton({ dateIso }: { dateIso: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => start(async () => setMsg((await refreshSales(dateIso)).message))}
        disabled={pending}
        className="btn-ghost"
      >
        {pending ? "Pulling…" : "↻ Pull sales from Square"}
      </button>
      {msg && <span className="text-xs text-crust/60">{msg}</span>}
    </div>
  );
}
