import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isSquareConfigured } from "@/lib/square";
import { DOW_NAMES } from "@/lib/dates";
import { FlavorRow, NumberSetting, ClearDataButton } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [flavors, formats, mappings, settings] = await Promise.all([
    prisma.flavor.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.format.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.productMapping.findMany({ include: { flavor: true, format: true } }),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <p className="text-sm text-crust/60">Phase 1 config: flavors, formats, Square mapping, forecaster knobs.</p>
      </header>

      <section className="card">
        <h2 className="mb-1 font-bold">Flavors</h2>
        <p className="mb-2 text-xs text-crust/50">
          Everything &amp; Asiago are confirmed; the other three are placeholders — rename them to your real flavors (spec §3).
        </p>
        {flavors.map((f) => (
          <FlavorRow key={f.id} flavor={{ id: f.id, name: f.name, active: f.active }} />
        ))}
      </section>

      <section className="card">
        <h2 className="mb-2 font-bold">Forecaster</h2>
        <NumberSetting
          settingKey="service_level"
          label="Target service level"
          hint="Fraction of comparable days you want demand fully met (higher = bake more)."
          value={String(settings.forecast.serviceLevel)}
          step="0.05"
        />
        <NumberSetting
          settingKey="recency_decay"
          label="Recency weight (decay)"
          hint="Lower = recent weeks dominate. 1 = all weeks equal."
          value={String(settings.forecast.recencyDecay)}
          step="0.05"
        />
      </section>

      <section className="card">
        <h2 className="mb-2 font-bold">Operating rhythm</h2>
        <NumberSetting settingKey="retail_open_time" label="Default open" value={settings.retailOpenTime} step="1" hint="HH:MM (24h) — used for sell-out math." />
        <NumberSetting settingKey="retail_close_time" label="Default close" value={settings.retailCloseTime} step="1" hint="HH:MM (24h)." />
        <div className="flex items-center justify-between py-1 text-sm">
          <span>Sysco order deadline</span>
          <span className="font-semibold">{DOW_NAMES[settings.orderDeadlineDow]}</span>
        </div>
        <div className="flex items-center justify-between py-1 text-sm">
          <span>Order alert window</span>
          <span className="font-semibold">{settings.orderAlertWindowDays} days</span>
        </div>
        <div className="flex items-center justify-between py-1 text-sm">
          <span>Starter buffer</span>
          <span className="font-semibold">{settings.starterBufferPct}%</span>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 font-bold">Formats</h2>
        <div className="space-y-1 text-sm">
          {formats.map((f) => (
            <div key={f.id} className="flex justify-between">
              <span>{f.name}</span>
              <span className="text-crust/50">{f.isSammie ? "sammie" : `${f.bagelsPerUnit} bagel${f.bagelsPerUnit > 1 ? "s" : ""}`}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Square</h2>
          <span className={`pill ${isSquareConfigured() ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {isSquareConfigured() ? "connected" : "mock (no token)"}
          </span>
        </div>
        <p className="mb-2 mt-1 text-xs text-crust/50">
          {mappings.length} product mapping{mappings.length === 1 ? "" : "s"} (variation/modifier → flavor + format, spec §8). Phase 1 uses the mock; set SQUARE_ACCESS_TOKEN to go live.
        </p>
        <div className="space-y-1 text-sm">
          {mappings.map((m) => (
            <div key={m.id} className="flex justify-between text-xs">
              <span className="font-mono text-crust/60">{m.squareVariationId}</span>
              <span>
                {m.flavor.name} · {m.format.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="card border-red-200">
        <h2 className="mb-1 font-bold text-red-700">Start fresh</h2>
        <p className="mb-3 text-sm text-crust/60">
          The app ships with sample bake history so you can see how it works. When you&apos;re ready to track your real
          bakery, clear it here. Your flavors, formats, and settings stay — only the sample bake history and plans are
          removed.
        </p>
        <ClearDataButton />
      </section>
    </div>
  );
}
