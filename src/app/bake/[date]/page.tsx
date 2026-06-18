import Link from "next/link";
import { notFound } from "next/navigation";
import { getBakeRecord } from "@/lib/queries";
import { parseIsoDate, shortLabel } from "@/lib/dates";
import RefreshSalesButton from "../RefreshSalesButton";

export const dynamic = "force-dynamic";

export default async function DayDetail({ params }: { params: { date: string } }) {
  const dateIso = params.date;
  let date: Date;
  try {
    date = parseIsoDate(dateIso);
  } catch {
    notFound();
  }
  const record = await getBakeRecord(date!);
  if (!record) {
    return (
      <div className="space-y-4">
        <Link href="/bake" className="text-sm text-crust/60 underline">
          ← Bake
        </Link>
        <div className="card">
          No bake record for {shortLabel(date!)}.{" "}
          <Link href="/bake" className="underline">
            Enter one
          </Link>
          .
        </div>
      </div>
    );
  }

  const st = record.totalBaked > 0 ? Math.round((record.totalSold / record.totalBaked) * 100) : 0;
  const waste = record.totalBaked - record.totalSold;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/bake" className="text-sm text-crust/60 underline">
          ← Bake
        </Link>
        <RefreshSalesButton dateIso={dateIso} />
      </div>

      <header>
        <h1 className="text-2xl font-extrabold">{shortLabel(date!)}</h1>
        <p className="text-sm text-crust/60">
          {record.retailOpenTime ?? "—"}–{record.retailCloseTime ?? "—"}
          {record.soldOut && record.soldOutTime ? ` · sold out ${record.soldOutTime}` : ""}
        </p>
      </header>

      <section className="grid grid-cols-4 gap-3">
        <Kpi label="Baked" value={record.totalBaked} />
        <Kpi label="Sold" value={record.totalSold} />
        <Kpi label="Sell-through" value={`${st}%`} />
        <Kpi label="Waste" value={waste} tone={waste > 0 ? "warn" : "ok"} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">Per flavor</h2>
        {record.lines
          .slice()
          .sort((a, b) => a.flavor.displayOrder - b.flavor.displayOrder)
          .map((l) => {
            const pct = l.qtyBaked > 0 ? Math.min(100, Math.round((l.qtySold / l.qtyBaked) * 100)) : 0;
            const remaining = l.qtyBaked - l.qtySold;
            return (
              <div key={l.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{l.flavor.name}</span>
                  <span className="tabular-nums text-crust/70">
                    {l.qtySold}/{l.qtyBaked} sold
                    {l.flavorSoldOut ? (
                      <span className="pill ml-2 bg-red-100 text-red-700">out {l.flavorSoldOutTime ?? ""}</span>
                    ) : remaining > 0 ? (
                      <span className="pill ml-2 bg-crust/10 text-crust/60">{remaining} left</span>
                    ) : null}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-crust/10">
                  <div
                    className={`h-full rounded-full ${l.flavorSoldOut ? "bg-red-500" : "bg-crust"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
      </section>

      {record.notes && (
        <section className="card">
          <h2 className="label mb-1">Notes</h2>
          <p className="text-sm">{record.notes}</p>
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" }) {
  return (
    <div className="card !p-3 text-center">
      <div className="label">{label}</div>
      <div className={`stat ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
    </div>
  );
}
