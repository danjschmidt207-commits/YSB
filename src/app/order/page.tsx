import Link from "next/link";
import { getPlanForWeek, getIngredients } from "@/lib/queries";
import { DevBanner } from "@/components/DevBanner";
import { getConfig } from "@/lib/serverConfig";
import { appToday } from "@/lib/today";
import { weekStartWednesday, addDays, shortLabel } from "@/lib/dates";
import { weeklyDemandGrams, unitGrams } from "@/lib/calc";

export const dynamic = "force-dynamic";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export default async function OrderPage() {
  const today = appToday();
  const targetWed = addDays(weekStartWednesday(today), 7);
  const [plan, ingredients, config] = await Promise.all([getPlanForWeek(targetWed), getIngredients(), getConfig()]);

  if (!plan) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Order</h1>
        <div className="card">
          No plan for the week of {shortLabel(targetWed)}.{" "}
          <Link href="/plan" className="underline">Create one in Plan</Link> — the order is built from the week&apos;s totals.
        </div>
      </div>
    );
  }

  const demand = weeklyDemandGrams(plan.days.map((d) => d.plannedTotal), config.dough, config.starter, config.schmear);

  interface OrderLine {
    name: string;
    category: string;
    supplier: string;
    unit: string;
    demandUnits: number;
    onHand: number;
    needUnits: number;
    packSize: number;
    packs: number;
    orderUnits: number;
    cost: number;
  }
  const lines: OrderLine[] = [];
  const alsoLow: { name: string; unit: string; current: number; suggest: number }[] = [];

  for (const ing of ingredients) {
    const gPer = unitGrams(ing.unit);
    const demandG = demand[ing.name.trim().toLowerCase()] ?? 0;
    if (gPer && demandG > 0) {
      const demandUnits = demandG / gPer;
      const needUnits = Math.max(0, demandUnits - ing.currentStock);
      const packSize = ing.packSize && ing.packSize > 0 ? ing.packSize : 1;
      const packs = needUnits > 0 ? Math.ceil(needUnits / packSize) : 0;
      const orderUnits = packs * packSize;
      lines.push({
        name: ing.name,
        category: ing.category,
        supplier: ing.supplier,
        unit: ing.unit,
        demandUnits,
        onHand: ing.currentStock,
        needUnits,
        packSize,
        packs,
        orderUnits,
        cost: orderUnits * (ing.costPerUnit ?? 0),
      });
    } else if (ing.currentStock <= ing.reorderPoint) {
      // No recipe demand (e.g. packaging) but at/below reorder point.
      alsoLow.push({ name: ing.name, unit: ing.unit, current: ing.currentStock, suggest: Math.max(0, ing.parLevel - ing.currentStock) });
    }
  }

  const toOrder = lines.filter((l) => l.packs > 0);
  const covered = lines.filter((l) => l.packs === 0);
  const total = toOrder.reduce((s, l) => s + l.cost, 0);

  // Group order lines by supplier.
  const bySupplier = new Map<string, OrderLine[]>();
  for (const l of toOrder) {
    if (!bySupplier.has(l.supplier)) bySupplier.set(l.supplier, []);
    bySupplier.get(l.supplier)!.push(l);
  }

  return (
    <div className="space-y-6">
      <DevBanner name="Order" />
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Order</h1>
          <p className="text-sm text-crust/60">Week of {shortLabel(targetWed)} · plan {plan.status} · {plan.days.reduce((s, d) => s + d.plannedTotal, 0)} bagels</p>
        </div>
        <Link href="/inventory" className="text-sm text-crust/60 underline">Inventory →</Link>
      </header>

      <div className="card flex items-center justify-between bg-sesame/20">
        <span className="font-semibold">Estimated order total</span>
        <span className="text-3xl font-extrabold">{money(total)}</span>
      </div>

      {[...bySupplier.entries()].map(([supplier, items]) => (
        <section key={supplier} className="space-y-1">
          <h2 className="font-bold capitalize">{supplier}</h2>
          <div className="overflow-x-auto rounded-2xl border border-crust/10 bg-white">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-crust/5">
                <tr>
                  <th className="th">Item</th>
                  <th className="th text-right">Need</th>
                  <th className="th text-right">On hand</th>
                  <th className="th text-right">Order</th>
                  <th className="th text-right">Packs</th>
                  <th className="th text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.name} className="border-t border-crust/5">
                    <td className="td font-semibold">{l.name}</td>
                    <td className="td text-right">{l.demandUnits.toFixed(1)} {l.unit}</td>
                    <td className="td text-right">{l.onHand} {l.unit}</td>
                    <td className="td text-right font-semibold">{l.orderUnits.toFixed(0)} {l.unit}</td>
                    <td className="td text-right">{l.packs} × {l.packSize}</td>
                    <td className="td text-right">{money(l.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {covered.length > 0 && (
        <section className="card">
          <h2 className="mb-1 font-bold text-green-700">Already covered by stock</h2>
          <p className="text-sm text-crust/60">{covered.map((l) => l.name).join(", ")} — enough on hand for this week.</p>
        </section>
      )}

      {alsoLow.length > 0 && (
        <section className="card border-amber-200">
          <h2 className="mb-1 font-bold text-amber-700">Also at/below reorder</h2>
          <div className="space-y-1 text-sm">
            {alsoLow.map((a) => (
              <div key={a.name} className="flex justify-between">
                <span>{a.name}</span>
                <span className="text-crust/60">{a.current} {a.unit} — top up ~{a.suggest} {a.unit}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-crust/50">
        Order = weekly recipe demand − on-hand stock, rounded up to pack sizes. Costs are estimates from Inventory —
        update pack sizes &amp; prices there. Update counts in <Link href="/inventory" className="underline">Inventory</Link> before ordering.
      </p>
    </div>
  );
}
