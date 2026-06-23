import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yard Sale Bagels — Ops",
  description: "Plan the week, calculate prep, order ingredients, and learn from your sales.",
};

// Nav is organized into color-coded groups so the workflow is obvious at a glance.
// `dev` marks tabs that aren't production-ready yet.
type NavItem = { href: string; label: string; dev?: boolean };
interface NavGroup {
  items: NavItem[];
  // Literal Tailwind classes (no dynamic concatenation, so they aren't purged).
  box: string;
  link: string;
}

const NAV_GROUPS: NavGroup[] = [
  // Home — neutral
  { items: [{ href: "/", label: "Home" }], box: "", link: "text-crust/70 hover:bg-crust/5" },
  // Plan — neutral
  { items: [{ href: "/plan", label: "Plan" }], box: "", link: "text-crust/70 hover:bg-crust/5" },
  // Bake-day flow (in order): Starter → Dough → Bake
  {
    items: [
      { href: "/starter", label: "Starter" },
      { href: "/dough", label: "Dough" },
      { href: "/bake", label: "Bake" },
    ],
    box: "bg-amber-100/60",
    link: "text-amber-900 hover:bg-amber-200/70",
  },
  // Schmear — its own step
  { items: [{ href: "/schmear", label: "Schmear" }], box: "bg-emerald-100/60", link: "text-emerald-900 hover:bg-emerald-200/70" },
  // Stock & ordering
  {
    items: [
      { href: "/inventory", label: "Inventory", dev: true },
      { href: "/order", label: "Order", dev: true },
    ],
    box: "bg-sky-100/60",
    link: "text-sky-900 hover:bg-sky-200/70",
  },
  // Analysis
  {
    items: [
      { href: "/reports", label: "Reports", dev: true },
      { href: "/insights", label: "Insights" },
    ],
    box: "bg-violet-100/60",
    link: "text-violet-900 hover:bg-violet-200/70",
  },
  // Settings — neutral
  { items: [{ href: "/settings", label: "Settings" }], box: "", link: "text-crust/70 hover:bg-crust/5" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
          <header className="sticky top-0 z-10 border-b border-crust/10 bg-board/90 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl">🥯</span>
                <span className="font-extrabold tracking-tight">Yard Sale Bagels</span>
              </Link>
              <span className="pill bg-crust/10 text-crust/60">Phase 1</span>
            </div>
            <nav className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
              {NAV_GROUPS.map((group, gi) => (
                <div key={gi} className={`flex items-center gap-0.5 rounded-xl ${group.box ? `${group.box} p-0.5` : ""}`}>
                  {group.items.map((n) => (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${group.link}`}
                      title={n.dev ? "In development — not production ready" : undefined}
                    >
                      {n.label}
                      {n.dev && <sup className="ml-0.5 text-[9px] font-medium uppercase opacity-60">dev</sup>}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </header>
          <main className="flex-1 px-4 py-5">{children}</main>
          <footer className="px-4 py-6 text-center text-xs text-crust/40">
            Yard Sale Bagels Ops · plan · prep · order · insights
          </footer>
        </div>
      </body>
    </html>
  );
}
