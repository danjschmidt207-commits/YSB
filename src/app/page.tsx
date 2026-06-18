import Link from "next/link";
import { prisma } from "@/lib/db";
import { getBakeRecord, getPlanForWeek, getRecentBakeRecords } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { appToday } from "@/lib/today";
import {
  addDays,
  dow,
  isoDate,
  shortLabel,
  weekStartWednesday,
  openWeekDates,
  nextOpenDay,
  isOpenDay,
  DOW_NAMES,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function Home() {
  const today = appToday();
  const settings = await getSettings();

  const targetWed = addDays(weekStartWednesday(today), 7); // next week (the one being planned)
  const [todayRec, recent, nextPlan] = await Promise.all([
    getBakeRecord(today),
    getRecentBakeRecords(7),
    getPlanForWeek(targetWed),
  ]);

  // Sysco countdown (HOME-1): days until the order deadline dow.
  let n = 0;
  while (dow(addDays(today, n)) !== settings.orderDeadlineDow && n < 7) n++;
  const deadlineDate = addDays(today, n);
  const ordered = nextPlan?.status === "ordered";
  const showOrderAlert = !ordered && n <= settings.orderAlertWindowDays;

  // KPIs over the trailing open days.
  const baked7 = recent.reduce((s, r) => s + r.totalBaked, 0);
  const sold7 = recent.reduce((s, r) => s + r.totalSold, 0);
  const sellThrough7 = baked7 > 0 ? Math.round((sold7 / baked7) * 100) : 0;

  // This open-week stats.
  const weekDates = openWeekDates(weekStartWednesday(today)).map(isoDate);
  const weekRecs = await prisma.bakeRecord.findMany({
    where: { date: { in: weekDates.map((d) => new Date(d + "T00:00:00.000Z")) } },
  });
  const weekWaste = weekRecs.reduce((s, r) => s + Math.max(0, r.totalBaked - r.totalSold), 0);
  const weekSoldOutDays = weekRecs.filter((r) => r.soldOut).length;

  const nextBakeDay = isOpenDay(dow(today)) && !todayRec ? today : nextOpenDay(today);
  const plannedNext = await plannedTotalFor(nextBakeDay);

  const hour = new Date().getUTCHours();
  const showStarter = hour >= settings.starterHintAfterHour || true; // always show the forward-looking card

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Today</h1>
          <p className="text-sm text-crust/60">{shortLabel(today)}</p>
        </div>
        <Link href="/bake" className="btn-primary">
          Enter bake →
        </Link>
      </header>

      {/* Alerts */}
      <div className="space-y-2">
        {showOrderAlert && (
          <Alert tone="amber">
            <strong>Sysco order due {n === 0 ? "today" : `in ${n} day${n === 1 ? "" : "s"}`}</strong> ({shortLabel(deadlineDate)}).
            {nextPlan ? (
              nextPlan.status === "locked" ? (
                <> Next week is locked — <Link href="/plan" className="underline">ready to order</Link>.</>
              ) : (
                <> Next week is still a draft — <Link href="/plan" className="underline">lock it</Link> before the deadline.</>
              )
            ) : (
              <> No plan for next week yet — <Link href="/plan" className="underline">generate one</Link>.</>
            )}
          </Alert>
        )}
      </div>

      {/* Today's bake vs sold */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Today&apos;s bake</h2>
          {todayRec && (
            <Link href={`/bake/${isoDate(today)}`} className="text-sm text-crust/60 underline">
              detail →
            </Link>
          )}
        </div>
        {!todayRec ? (
          <p className="text-sm text-crust/60">
            {isOpenDay(dow(today)) ? (
              <>Nothing entered yet. <Link href="/bake" className="underline">Enter this morning&apos;s bake →</Link></>
            ) : (
              <>Closed today (Mon/Tue). Next open day: {DOW_NAMES[dow(nextOpenDay(today))]}.</>
            )}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Baked" value={todayRec.totalBaked} />
            <Kpi label="Sold" value={todayRec.totalSold} />
            <Kpi
              label="Status"
              value={todayRec.soldOut ? `out ${todayRec.soldOutTime ?? ""}` : `${todayRec.totalBaked - todayRec.totalSold} left`}
            />
          </div>
        )}
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-3 gap-3">
        <Kpi label="7-day sell-through" value={`${sellThrough7}%`} />
        <Kpi label="Waste this week" value={weekWaste} tone={weekWaste > 0 ? "warn" : "ok"} />
        <Kpi label="Sold-out days (wk)" value={weekSoldOutDays} />
      </section>

      {/* Plan + starter */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card space-y-1">
          <div className="label">Next week&apos;s plan</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">Week of {shortLabel(targetWed)}</span>
            {nextPlan ? <StatusPill status={nextPlan.status} /> : <span className="pill bg-crust/10 text-crust/50">none</span>}
          </div>
          <Link href="/plan" className="text-sm text-crust/60 underline">
            Open planner →
          </Link>
        </div>

        {showStarter && (
          <div className="card space-y-1">
            <div className="label">Tonight&apos;s starter</div>
            <div className="text-sm text-crust/70">
              Next open day: <strong>{DOW_NAMES[dow(nextBakeDay)]}</strong> ({shortLabel(nextBakeDay)})
            </div>
            <div className="text-sm text-crust/70">
              Planned bagels: <strong>{plannedNext ?? "—"}</strong>
            </div>
            <div className="pill mt-1 bg-crust/10 text-crust/50">starter grams: Phase 2</div>
          </div>
        )}
      </section>

      {/* Quick links (HOME-3) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink href="/bake" label="Enter bake" emoji="🥟" />
        <QuickLink href="/plan" label="Plan week" emoji="📅" />
        <QuickLink href="/plan/weekday/4" label="Calibrate Thu" emoji="📈" />
        <QuickLink href="/settings" label="Settings" emoji="⚙️" />
      </section>
    </div>
  );
}

async function plannedTotalFor(date: Date): Promise<number | null> {
  const wed = weekStartWednesday(date);
  const plan = await getPlanForWeek(wed);
  if (!plan) return null;
  const day = plan.days.find((d) => isoDate(d.date) === isoDate(date));
  return day ? day.plannedTotal : null;
}

function Alert({ tone, children }: { tone: "amber" | "red"; children: React.ReactNode }) {
  const cls = tone === "amber" ? "bg-amber-50 text-amber-900 border-amber-200" : "bg-red-50 text-red-900 border-red-200";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" }) {
  return (
    <div className="card !p-3 text-center">
      <div className="label">{label}</div>
      <div className={`stat ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
    </div>
  );
}

function QuickLink({ href, label, emoji }: { href: string; label: string; emoji: string }) {
  return (
    <Link href={href} className="card flex flex-col items-center gap-1 !p-3 text-center hover:bg-crust/5">
      <span className="text-xl">{emoji}</span>
      <span className="text-xs font-semibold">{label}</span>
    </Link>
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
