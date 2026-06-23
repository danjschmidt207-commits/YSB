import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yard Sale Bagels — Ops",
  description: "Plan the week, calculate prep, order ingredients, and learn from your sales.",
};

// Production-ready tools.
const NAV = [
  { href: "/", label: "Home" },
  { href: "/bake", label: "Bake" },
  { href: "/plan", label: "Plan" },
  { href: "/prep", label: "Prep" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" },
];

// Not yet production-ready — grouped separately and labelled.
const NAV_DEV = [
  { href: "/inventory", label: "Inventory" },
  { href: "/order", label: "Order" },
  { href: "/reports", label: "Reports" },
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
            <nav className="flex flex-wrap items-center gap-1 px-2 pb-2">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-crust/70 hover:bg-crust/5"
                >
                  {n.label}
                </Link>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-crust/15 sm:inline-block" aria-hidden />
              <span className="pill bg-crust/5 text-[10px] uppercase tracking-wide text-crust/40">In dev</span>
              {NAV_DEV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-crust/40 hover:bg-crust/5"
                  title="In development — not production ready"
                >
                  {n.label}
                </Link>
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
