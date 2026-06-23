// Square integration (spec §8) — pulls completed orders and normalizes them to per-modifier
// SaleLine units. Bagel flavor / schmear live in each order line's MODIFIERS, and each modifier
// carries a quantity (e.g. a 6-box = "Everything × 2, Asiago × 3, Plain"). We emit one SaleLine
// per modifier selection with its quantity, so multi-bagel boxes count correctly.
//
// Real client uses a Personal Access Token (server-side env). When SQUARE_ACCESS_TOKEN is unset,
// a mock generates realistic history so the import → attribute → insights flow is testable.

import { OPEN_DOWS } from "./dates";

export interface SaleLine {
  uid: string; // stable id (orderId:lineUid:modifierIndex) for dedupe
  soldAt: string; // ISO datetime
  itemName: string;
  modifier: string; // a single modifier name (a flavor, a schmear, or something to ignore)
  qty: number; // modifier quantity × line quantity (number of bagels/tubs)
}

export function isSquareConfigured(): boolean {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);
}

export function squareEnvLabel(): "production" | "sandbox" | "mock" {
  if (!isSquareConfigured()) return "mock";
  return process.env.SQUARE_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
}

function baseUrl(): string {
  return process.env.SQUARE_ENVIRONMENT === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

function intQty(v: string | undefined): number {
  const n = Math.round(Number(v ?? "1"));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Fetch completed-order sale lines between two ISO dates (inclusive). Mock when unconfigured. */
export async function fetchSquareSales(startIso: string, endIso: string): Promise<{ source: string; lines: SaleLine[] }> {
  if (!isSquareConfigured()) {
    return { source: "mock", lines: mockSales(startIso, endIso) };
  }
  const token = process.env.SQUARE_ACCESS_TOKEN!;
  const locationId = process.env.SQUARE_LOCATION_ID!;
  const start = new Date(startIso + "T00:00:00.000Z").toISOString();
  const end = new Date(endIso + "T23:59:59.999Z").toISOString();

  const lines: SaleLine[] = [];
  let cursor: string | undefined;
  do {
    const res = await fetch(`${baseUrl()}/v2/orders/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Square-Version": "2025-01-23",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        location_ids: [locationId],
        cursor,
        limit: 500,
        query: {
          filter: {
            date_time_filter: { closed_at: { start_at: start, end_at: end } },
            state_filter: { states: ["COMPLETED"] },
          },
          sort: { sort_field: "CLOSED_AT", sort_order: "ASC" },
        },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Square API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as SquareOrdersResponse;
    for (const order of data.orders ?? []) {
      const soldAt = order.closed_at ?? order.created_at ?? end;
      for (const li of order.line_items ?? []) {
        const lineQty = intQty(li.quantity);
        const lineUid = li.uid ?? Math.random().toString(36).slice(2);
        (li.modifiers ?? []).forEach((mod, i) => {
          if (!mod.name) return;
          lines.push({
            uid: `${order.id}:${lineUid}:${i}`,
            soldAt,
            itemName: li.name ?? "Item",
            modifier: mod.name,
            qty: intQty(mod.quantity) * lineQty,
          });
        });
      }
    }
    cursor = data.cursor;
  } while (cursor);

  return { source: squareEnvLabel(), lines };
}

interface SquareOrdersResponse {
  orders?: {
    id: string;
    created_at?: string;
    closed_at?: string;
    line_items?: {
      uid?: string;
      name?: string;
      quantity?: string;
      variation_name?: string;
      modifiers?: { name?: string; quantity?: string }[];
    }[];
  }[];
  cursor?: string;
}

// ---- mock ----

const MOCK_FLAVORS: { name: string; weight: number }[] = [
  { name: "Everything", weight: 0.36 },
  { name: "Plain", weight: 0.16 },
  { name: "Asiago", weight: 0.17 },
  { name: "Salt", weight: 0.15 },
  // historical rotators (the operator maps these to "Rotator")
  { name: "Sesame", weight: 0.07 },
  { name: "Cheddar Jalepeño", weight: 0.04 },
  { name: "Cinnamon Sugar", weight: 0.03 },
  { name: "Poppy Seed", weight: 0.02 },
];
const MOCK_SCHMEARS: { name: string; weight: number }[] = [
  { name: "Plain CC", weight: 0.3 },
  { name: "Bacon & Scallion", weight: 0.28 },
  { name: "Chive & Herb", weight: 0.24 },
  { name: "Lox & Dill", weight: 0.14 },
  { name: "Butter", weight: 0.04 },
];
const WEEKDAY_VOLUME: Record<number, number> = { 3: 120, 4: 175, 5: 150, 6: 180, 0: 140 };

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng: () => number, items: { name: string; weight: number }[]): string {
  let r = rng() * items.reduce((s, i) => s + i.weight, 0);
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i.name;
  }
  return items[0].name;
}

/** Generate plausible per-modifier sale lines (one bagel per flavor line, ~40% with a schmear). */
function mockSales(startIso: string, endIso: string): SaleLine[] {
  const lines: SaleLine[] = [];
  const start = new Date(startIso + "T00:00:00.000Z");
  const end = new Date(endIso + "T00:00:00.000Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (!(OPEN_DOWS as readonly number[]).includes(dow)) continue;
    const dateIso = d.toISOString().slice(0, 10);
    const rng = mulberry32(hash(dateIso));
    const volume = Math.round((WEEKDAY_VOLUME[dow] ?? 130) * (0.9 + rng() * 0.2));
    for (let i = 0; i < volume; i++) {
      const minutes = Math.round(480 + Math.pow(rng(), 1.4) * 300); // 8:00 + front-loaded into 5h
      const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
      const mm = String(minutes % 60).padStart(2, "0");
      const at = `${dateIso}T${hh}:${mm}:00.000Z`;
      lines.push({ uid: `mock-${dateIso}-${i}-f`, soldAt: at, itemName: "Bagel", modifier: pick(rng, MOCK_FLAVORS), qty: 1 });
      if (rng() < 0.4) {
        lines.push({ uid: `mock-${dateIso}-${i}-s`, soldAt: at, itemName: "Bagel", modifier: pick(rng, MOCK_SCHMEARS), qty: 1 });
      }
    }
  }
  return lines;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
