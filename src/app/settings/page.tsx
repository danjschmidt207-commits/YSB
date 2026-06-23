import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/serverConfig";
import { DOW_NAMES } from "@/lib/dates";
import { isSquareConfigured, squareEnvLabel } from "@/lib/square";
import { FlavorRow, NumberSetting, DoughEditor, StarterEditor, SchmearEditor, DangerButtons } from "./SettingsClient";
import { SquareSection } from "./SquareClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [flavors, config, unmappedRow, diagRow] = await Promise.all([
    prisma.flavor.findMany({ orderBy: { displayOrder: "asc" } }),
    getConfig(),
    prisma.appSetting.findUnique({ where: { key: "square_unmapped" } }),
    prisma.appSetting.findUnique({ where: { key: "square_diag" } }),
  ]);
  const pctSum = flavors.filter((f) => f.active).reduce((s, f) => s + f.pct, 0);
  const unmapped: string[] = unmappedRow ? JSON.parse(unmappedRow.value) : [];
  const diag = diagRow ? diagRow.value : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <p className="text-sm text-crust/60">Flavors &amp; percentages, dough &amp; starter, schmears, and hours — all adjustable.</p>
      </header>

      <section className="card">
        <h2 className="mb-1 font-bold">Flavors &amp; daily mix</h2>
        <p className="mb-2 text-xs text-crust/50">
          4 permanent + 1 weekly rotator (name it each week in Plan). The % is each flavor&apos;s share of the daily total.
        </p>
        {flavors.map((f) => (
          <FlavorRow key={f.id} flavor={{ id: f.id, name: f.name, active: f.active, pct: f.pct, isRotator: f.isRotator }} />
        ))}
        <div className={`mt-1 text-xs ${pctSum === 100 ? "text-crust/40" : "text-amber-600"}`}>active total: {pctSum}% {pctSum !== 100 && "(should be 100)"}</div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-bold">Bagel dough recipe</h2>
          <p className="mb-2 text-xs text-crust/50">Ratio parts + dough weight per bagel.</p>
          <DoughEditor initial={config.dough} />
          <div className="mt-2 border-t border-crust/10 pt-2">
            <NumberSetting
              settingKey="dough_batch_max_lb"
              label="Max dough per mixer batch (lb)"
              value={String(config.doughBatchMaxLb)}
              hint="Mixer caps ~44 lb. The Dough tab splits each day into the fewest equal batches under this."
            />
          </div>
        </section>

        <section className="card">
          <h2 className="mb-2 font-bold">Sourdough starter</h2>
          <p className="mb-2 text-xs text-crust/50">Feed ratio (starter:flour:water), buffer, and lead time.</p>
          <StarterEditor initial={config.starter} />
        </section>
      </div>

      <section className="card">
        <h2 className="mb-2 font-bold">Schmears</h2>
        <p className="mb-2 text-xs text-crust/50">Serving size and the weekly split across the 4 types (base recipes are applied automatically).</p>
        <SchmearEditor initial={config.schmear} />
      </section>

      <section className="card">
        <h2 className="mb-2 font-bold">Hours &amp; cadence</h2>
        <NumberSetting settingKey="retail_open_time" label="Open" value={config.openTime} hint="HH:MM (24h)." />
        <NumberSetting settingKey="retail_close_time" label="Close" value={config.closeTime} hint="HH:MM (24h)." />
        <div className="flex items-center justify-between py-1 text-sm">
          <span>Plan lock deadline</span>
          <span className="font-semibold">{DOW_NAMES[config.lockDeadlineDow]}</span>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 font-bold">Square sales import</h2>
        <p className="mb-2 text-xs text-crust/50">
          Pull completed orders from Square to derive your real flavor &amp; schmear mix and demand (see Insights).
        </p>
        <SquareSection
          configured={isSquareConfigured()}
          env={squareEnvLabel()}
          flavors={flavors.map((f) => ({ id: f.id, name: f.name }))}
          schmears={config.schmear.types.map((t) => ({ key: t.key, name: t.name }))}
          initialUnmapped={unmapped}
          diag={diag}
        />
      </section>

      <section className="card border-red-200">
        <h2 className="mb-1 font-bold text-red-700">Data</h2>
        <p className="mb-3 text-sm text-crust/60">
          Clear the sample bake history when you&apos;re ready for real data. &quot;Reset to defaults&quot; also restores the
          standard flavors/recipes — use it once to switch an older database to this new version.
        </p>
        <DangerButtons />
      </section>
    </div>
  );
}
