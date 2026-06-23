import Link from "next/link";
import { getIngredients } from "@/lib/queries";
import { DevBanner } from "@/components/DevBanner";
import { StockRow } from "./InventoryClient";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  dough: "Dough",
  spread: "Spreads",
  topping: "Toppings",
  sammy: "Sammie",
  packaging: "Packaging",
  consumable: "Consumables",
};

export default async function InventoryPage() {
  const ingredients = await getIngredients();
  const lowCount = ingredients.filter((i) => i.currentStock <= i.reorderPoint).length;

  if (ingredients.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Inventory</h1>
        <div className="card">
          No ingredients yet. Go to <Link href="/settings" className="underline">Settings → Data → Reset to defaults</Link> to
          load the standard ingredient list, then come back to enter your counts.
        </div>
      </div>
    );
  }

  const byCategory = new Map<string, typeof ingredients>();
  for (const i of ingredients) {
    if (!byCategory.has(i.category)) byCategory.set(i.category, []);
    byCategory.get(i.category)!.push(i);
  }

  return (
    <div className="space-y-6">
      <DevBanner name="Inventory" />
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Inventory</h1>
          <p className="text-sm text-crust/60">Enter your weekly counts. {lowCount > 0 ? <span className="text-red-700">{lowCount} at/below reorder</span> : "all stocked"}.</p>
        </div>
        <Link href="/order" className="btn-ghost">Build order →</Link>
      </header>

      {[...byCategory.entries()].map(([cat, items]) => (
        <section key={cat} className="space-y-1">
          <h2 className="font-bold">{CATEGORY_LABELS[cat] ?? cat}</h2>
          <div className="overflow-hidden rounded-2xl border border-crust/10 bg-white">
            {items.map((i) => (
              <StockRow key={i.id} ing={{ id: i.id, name: i.name, unit: i.unit, currentStock: i.currentStock, parLevel: i.parLevel, reorderPoint: i.reorderPoint }} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
