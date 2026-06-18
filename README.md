# Yard Sale Bagels — Operations Dashboard (Phase 1)

Right-sizes the daily bake from real baked-vs-sold history, accounting for the
**censored-demand** problem: a day that sells out only tells you demand was *at least*
what you baked. This app de-censors those days before forecasting, so it stops telling
you to keep underbaking on your best days.

This is **Phase 1** of [the spec](./docs/spec.md) (§9): the "prove the loop" slice —
`CFG` → `BAKE` → `PLN` → `HOME`. Phases 2–3 (recipes/prep, inventory, starter, Sysco
ordering, QuickBooks reporting) are scaffolded in the data model but not yet surfaced.

## What works today

| Module | What it does | Spec IDs |
|---|---|---|
| **Home** (`/`) | Today's bake vs sold, Sysco order-due countdown, next week's plan status, 7-day sell-through / waste / sold-out KPIs, quick links. | HOME-1/-2/-3 |
| **Bake** (`/bake`) | Mobile-friendly per-flavor morning entry with steppers; pull sold from Square (mock); per-flavor sold/remaining bars, sell-through & waste; auto sold-out detection + timestamps. | BAKE-1…-6 |
| **Plan** (`/plan`) | Week planner (Wed–Sun) pre-filled by the forecaster, editable, lockable. Per-weekday calibration page shows the trailing 8 same-weekdays, the **de-censored true-demand** estimate per day, and a plain-English recommendation. | PLN-1…-6 |
| **Settings** (`/settings`) | Edit flavors (rename the 3 placeholders), forecaster knobs (service level, recency), view formats / Square mappings / operating rhythm. | CFG |

### The forecaster (spec §7)

`src/lib/forecast.ts` — pure, unit-tested (`npm test`). For each trailing same-weekday record:

- **Not sold out** → `demand = sold` (uncensored).
- **Sold out** → de-censor: `demand ≈ baked / cumShare(f)`, where `f` is the fraction of the
  retail window elapsed at sell-out and `cumShare(f)=f^k` is a front-loaded intraday curve
  (default `k=0.62` reproduces the spec's "≈75% of sales by 2.5h of a 4h day" example).

It then recency-weights the de-censored demands and takes a **target-service-level percentile**
(default 85%) for the recommended total, and splits it across flavors by de-censored demand share.
Every recommendation comes with a sentence explaining itself.

> Example from the seeded data — **Thursday**: sold an average of ~157 but sold out 8/8 times;
> de-censored that's ~189; at an 85% service level it recommends **205**. **Wednesday** never
> sells out, so it stays at **150** (not inflated).

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind** — per spec §4.
- **Prisma 6 + SQLite** for zero-setup local runs. The spec recommends Postgres for production;
  switching is a one-line `datasource` change in `prisma/schema.prisma` (plus re-introducing enums).
- **Square** is a **mock** (`src/lib/square.ts`) implementing the post-hoc-attribution interface
  from §8. It activates automatically when `SQUARE_ACCESS_TOKEN` is unset; the call sites don't
  change when you drop in the real client.

## Run it

```bash
npm install
npm run db:reset   # create SQLite db + seed ~12 weeks of realistic history
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm test           # forecaster unit tests
npm run build      # production build
npm run db:seed    # re-seed without dropping the schema
```

### Demo date

History is seeded relative to a pinned "today" of **2026-06-18** (a Thursday), set via
`APP_TODAY` in `.env`. Remove `APP_TODAY` to follow the system clock in real use.

## API surface (for cron / integrations, §8)

- `GET /api/forecast?dow=4` — JSON forecast for a weekday (0=Sun, 3=Wed…6=Sat).
- `POST /api/square/pull` `{ "date": "YYYY-MM-DD" }` — pull & attribute sales (today if no body).
  Intended to be triggered by a scheduled job.

## Project layout

```
prisma/
  schema.prisma      full data model (§5) — Phase 1 uses a subset
  seed.ts            ~12 weeks of realistic history + a draft plan
src/lib/
  forecast.ts        de-censored demand engine (§7)  + forecast.test.ts
  square.ts          mock Square client (§8 interface)
  dates.ts           open-week / weekday helpers (Wed–Sun)
  queries.ts         shared data loaders
  settings.ts        app settings + forecast config
src/app/
  page.tsx           Home
  bake/              Bake entry, day detail
  plan/              Week planner, per-weekday calibration
  settings/          Config
  api/               forecast + square pull routes
  actions.ts         server actions (mutations)
```

## Not in Phase 1 (next up, per §9)

Recipes/prep & weekly cream-cheese rollup (`RCP`), inventory + reorder flags (`INV`),
nightly sourdough starter calc (`STR`), Sysco order generation (`ORD`), and QuickBooks
financial reporting (`RPT`). The schema already models these so they slot in without a rewrite.
