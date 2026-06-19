"use client";

import { useRouter } from "next/navigation";

export default function DateNav({ dateIso }: { dateIso: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-crust/60">Date</span>
      <input
        type="date"
        value={dateIso}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => e.target.value && router.push(`/bake?date=${e.target.value}`)}
        className="rounded-lg border border-crust/20 px-3 py-1.5"
      />
    </label>
  );
}
