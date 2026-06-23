"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; dev?: boolean };
interface NavGroup {
  label?: string;
  items: NavItem[];
  // Literal Tailwind classes (no dynamic concatenation, so they aren't purged).
  box: string; // group container tint ("" = neutral)
  base: string; // link text color
  active: string; // active link background/weight
  hover: string;
}

const NEUTRAL = { box: "", base: "text-crust/70", active: "bg-crust/10 font-bold text-crust", hover: "hover:bg-crust/5" };

const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: "/", label: "Home" }], ...NEUTRAL },
  { items: [{ href: "/plan", label: "Plan" }], ...NEUTRAL },
  {
    label: "Bake day",
    items: [
      { href: "/starter", label: "Starter" },
      { href: "/dough", label: "Dough" },
      { href: "/bake", label: "Bake" },
    ],
    box: "bg-amber-100/50",
    base: "text-amber-900",
    active: "bg-amber-200/80 font-bold",
    hover: "hover:bg-amber-200/60",
  },
  {
    label: "Schmear prep",
    items: [{ href: "/schmear", label: "Schmear" }],
    box: "bg-emerald-100/50",
    base: "text-emerald-900",
    active: "bg-emerald-200/80 font-bold",
    hover: "hover:bg-emerald-200/60",
  },
  {
    label: "Stock & ordering",
    items: [
      { href: "/inventory", label: "Inventory", dev: true },
      { href: "/order", label: "Order", dev: true },
    ],
    box: "bg-sky-100/50",
    base: "text-sky-900",
    active: "bg-sky-200/80 font-bold",
    hover: "hover:bg-sky-200/60",
  },
  {
    label: "Analysis",
    items: [
      { href: "/reports", label: "Reports", dev: true },
      { href: "/insights", label: "Insights" },
    ],
    box: "bg-violet-100/50",
    base: "text-violet-900",
    active: "bg-violet-200/80 font-bold",
    hover: "hover:bg-violet-200/60",
  },
  { items: [{ href: "/settings", label: "Settings" }], ...NEUTRAL },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="space-y-2">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className={`rounded-xl p-1 ${group.box}`}>
          {group.label && <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-crust/40">{group.label}</div>}
          {group.items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${group.base} ${
                isActive(pathname, n.href) ? group.active : group.hover
              }`}
              title={n.dev ? "In development — not production ready" : undefined}
            >
              <span>{n.label}</span>
              {n.dev && <sup className="text-[9px] font-medium uppercase opacity-60">dev</sup>}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

const Brand = () => (
  <Link href="/" className="flex items-center gap-2">
    <span className="text-xl">🥯</span>
    <span className="font-extrabold tracking-tight">Yard Sale Bagels</span>
  </Link>
);

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: persistent left sidebar */}
      <aside className="hidden md:flex md:h-screen md:w-56 md:flex-col md:gap-3 md:overflow-y-auto md:border-r md:border-crust/10 md:bg-board/60 md:p-3 md:sticky md:top-0">
        <Brand />
        <NavList pathname={pathname} />
      </aside>

      {/* Mobile: top bar + slide-in drawer */}
      <div className="md:hidden">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-crust/10 bg-board/90 px-4 py-3 backdrop-blur">
          <Brand />
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg border border-crust/15 px-3 py-1.5 text-sm font-semibold text-crust/70">
            ☰ Menu
          </button>
        </div>
        {open && (
          <div className="fixed inset-0 z-30" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-crust/40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-board p-3 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <Brand />
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg px-2 py-1 text-lg text-crust/60">✕</button>
              </div>
              <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
