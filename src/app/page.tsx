import Link from "next/link";
import { prisma } from "@/lib/db";
import { getBakeRecord, getPlanForWeek, getRecentBakeRecords } from "@/lib/queries";
import { getConfig } from "@/lib/serverConfig";
import { appToday } from "@/lib/today";
import { starterForBagels, weeklySchmear, g } from "@/lib/calc";
import { addDays, dow, isoDate, shortLabel, weekStartWednesday, openWeekDates, isOpenDay, DOW_NAMES } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function Home() {
  const today = appToday();
  const config = await getConfig();

  const targetWed = addDays(weekStartWednesday(today), 7); // next week (being planned)
  const [todayRec, recent, nextPlan] = await Promise.all([
    getBakeRecord(today),
    getRecentBakeRecords(7),
    getPlanForWeek(targetWed),
  ]);

  // Lock countdown to the next deadline weekday (Tuesday).
  let n = 0;
  while (dow(addDays(today, n)) !== config.lockDeadlineDow && n < 7) n++;
  const deadlineDate = addDays(today, n);
  const planReady = nextPlan?.status === "locked" || nextPlan?.status === "ordered";
  const showLockAlert = !planReady && n <= config.alertWindowDays;

  // Tonight's starter feed: serves the bake day `leadNights` from now.
  const bakeForTonight = addDays(today, config.starter.leadNights);
  let tonightFeed: { bakeLabel: string; bagels: number; buildG: number; seedG: number; flourG: number; waterG: number } | null = null;
  if (isOpenDay(dow(bakeForTonight))) {
    const plan = await getPlanForWeek(weekStartWednesday(bakeForTonight));
    const day = plan?.days.find((d) => isoDate(d.date) === isoDate(bakeForTonight));
    if (day && day.plannedTotal > 0) {
      const s = starterForBagels(day.plannedTotal, config.dough, config.starter);
      tonightFeed = {
        bakeLabel: `${DOW_NAMES[dow(bakeForTonight)]} ${isoDate(bakeForTonight).slice(5)}`,
        bagels: day.plannedTotal,
        buildG: s.buildG,
        seedG: s.seedG,
        flourG: s.flourG,
        waterG: s.waterG,
      };
    }
  }

  // KPIs.
  const baked7 = recent.reduce((s, r) => s + r.totalBaked, 0);
  const sold7 = recent.reduce((s, r) => s + r.totalSold, 0);
  const sellThrough7 = baked7 > 0 ? Math.round((sold7 / baked7) * 100) : 0;

  const weekDates = openWeekDates(weekStartWednesday(today)).map((d) => new Date(isoDate(d) + "T00:00:00.000Z"));
  const weekRecs = await prisma.bakeRecord.findMany({ where: { date: { in: weekDates } } });
  const weekWaste = weekRecs.reduce((s, r) => s + Math.max(0, r.totalBaked - r.totalSold), 0);
  const weekSoldOutDays = weekRecs.filter((r) => r.soldOut).length;

  // Next week's schmear/cream cheese headline.
  const nextWeekBagels = nextPlan?.days.reduce((s, d) => s + d.plannedTotal, 0) ?? 0;
  const schmear = nextWeekBagels > 0 ? weeklySchmear(nextWeekBagels, config.schmear) : null;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Today</h1>
          <p className="text-sm text-crust/60">{shortLabel(today)}</p>
        </div>
        <Link href="/bake" className="btn-primary">Enter bake →</Link>
      </header>

      {showLockAlert && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Lock next week&apos;s plan {n === 0 ? "today" : `in ${n} day${n === 1 ? "" : "s"}`}</strong> (by {shortLabel(deadlineDate)}).
          {nextPlan ? (
            <> Week of {shortLabel(targetWed)} is a draft — <Link href="/plan" className="underline">review &amp; lock it</Link>.</>
          ) : (
            <> No plan yet — <Link href="/plan" className="underline">generate one</Link>.</>
          )}
        </div>
      )}

      {tonightFeed && (
        <div className="card border-crust/20 bg-sesame/20">
          <div className="label">Feed starter tonight</div>
          <div className="text-2xl font-extrabold">{g(tonightFeed.buildG)}</div>
          <div className="text-sm text-crust/70">
            for {tonightFeed.bagels} bagels on {tonightFeed.bakeLabel} — starter {g(tonightFeed.seedG)} · flour {g(tonightFeed.flourG)} · water {g(tonightFeed.waterG)}
          </div>
        </div>
      )}

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Today&apos;s bake</h2>
          {todayRec && <Link href={`/bake/${isoDate(today)}`} className="text-sm text-crust/60 underline">detail →</Link>}
        </div>
        {!todayRec ? (
          <p className="text-sm text-crust/60">
            {isOpenDay(dow(today)) ? (
              <>Nothing entered yet. <Link href="/bake" className="underline">Enter today&apos;s bake →</Link></>
            ) : (
              <>Closed today. Next open day: {DOW_NAMES[dow(addDays(today, 1))] === "Monday" ? "Wednesday" : DOW_NAMES[dow(addDays(today, 1))]}.</>
            )}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Baked" value={todayRec.totalBaked} />
            <Kpi label="Sold" value={todayRec.totalSold} />
            <Kpi label="Status" value={todayRec.soldOut ? `out ${todayRec.soldOutTime ?? ""}` : `${todayRec.totalBaked - todayRec.totalSold} left`} />
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Kpi label="7-day sell-through" value={`${sellThrough7}%`} />
        <Kpi label="Waste this week" value={weekWaste} tone={weekWaste > 0 ? "warn" : "ok"} />
        <Kpi label="Sold-out days (wk)" value={weekSoldOutDays} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card space-y-1">
          <div className="label">Next week&apos;s plan</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">Week of {shortLabel(targetWed)}</span>
            {nextPlan ? <StatusPill status={nextPlan.status} /> : <span className="pill bg-crust/10 text-crust/50">none</span>}
          </div>
          <div className="text-sm text-crust/60">{nextWeekBagels} bagels{nextPlan?.rotatorName ? ` · rotator: ${nextPlan.rotatorName}` : ""}</div>
          <div className="flex gap-3 text-sm">
            <Link href="/plan" className="text-crust/60 underline">Plan →</Link>
            <Link href="/prep" className="text-crust/60 underline">Prep →</Link>
          </div>
        </div>

        <div className="card space-y-1">
          <div className="label">Schmear order (next week)</div>
          {schmear ? (
            <>
              <div className="text-2xl font-extrabold">{schmear.creamCheeseTotalLb.toFixed(0)} lb</div>
              <div className="text-sm text-crust/60">Philadelphia cream cheese · {config.schmear.servingOz} oz/bagel</div>
              <Link href="/prep" className="text-sm text-crust/60 underline">Schmear recipes →</Link>
            </>
          ) : (
            <div className="text-sm text-crust/60">Plan next week to see schmear amounts.</div>
          )}
        </div>
      </section>
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
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-amber-100 text-amber-700",
    locked: "bg-green-100 text-green-700",
    ordered: "bg-blue-100 text-blue-700",
  };
  return <span className={`pill ${map[status] ?? "bg-crust/10"}`}>{status}</span>;
}
