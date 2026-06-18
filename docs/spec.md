# Yard Sale Bagels — Operations Dashboard & App
## Product & Technical Specification (Living Document)

**Version:** 0.1 (draft)
**Date:** June 18, 2026
**Owner:** Dan
**Status:** Pre-build spec. This document is the consolidated build plan; the chat it came from is the running idea log. New ideas get appended to §11 and folded into the relevant module.

---

## 0. How to read this document

- Requirements have IDs (e.g. `PLN-3`) so we can reference them during the build and check them off.
- **Assumptions** are flagged inline and collected in §10. Confirm or correct them before building.
- This is intentionally over-complete. The phased roadmap in §9 says what to build first; the rest is the destination.

A note on terminology: throughout this doc "**Sysco**" refers to your foodservice distributor (you wrote "Cisco"). Correct me if it's a different supplier.

---

## 1. Vision & goals

Right now the operation runs on tribal knowledge — bake quantities are a feel, and the weekly order lives in your business partner's head. The goal of this app is to turn that into a written, data-driven system that:

1. **Right-sizes the daily bake** for each day of the week *and* each flavor, using actual baked-vs-sold history.
2. **Forecasts a full week ahead** so the numbers are ready *before* the Sysco order goes out mid-week.
3. **Explodes the weekly plan into ingredient needs** (dough, toppings, cream cheese, sammy components, packaging) so the Sysco order writes itself.
4. **Tracks inventory** of everything consumable, with low-stock alerts, replacing the "it's all in my head" system.
5. **Manages the nightly sourdough starter** so the right amount (plus a 10% buffer) is built every evening for the next day's dough.
6. **Unifies reporting** by pulling sales from Square and financials from QuickBooks, so you can see sell-through, waste, food cost, and margin in one place.

The north-star metric: **reduce both stockouts and waste** — bake enough to capture demand on fast days (Thursday selling out in 2.5 hours) without overbaking on slow days (Wednesday selling 125 of 150).

---

## 2. Glossary & core concepts

| Term | Meaning |
|---|---|
| **Flavor** | A bagel variety (Everything, Asiago, …). 5 flavors currently. |
| **Format** | How a bagel is sold: Single, 6-Box, 12-Box, Catering Box, Sammie. |
| **Bake record** | One day's actual: per-flavor quantity baked, total baked, per-flavor sold, total sold, sold-out flag, sold-out time. |
| **Sell-through** | Sold ÷ baked, as a %. |
| **Sold-out (censored demand)** | A day that sold out tells you demand was *at least* what you baked — true demand is unknown and higher. This matters for forecasting (see §7). |
| **Par level** | Target on-hand stock for an ingredient. |
| **Reorder point** | Stock level that triggers a "reorder" flag. |
| **Baker's percentage** | Recipe expressed as % of total flour weight (flour = 100%). Scales cleanly with batch size. |
| **BOM (bill of materials)** | The recipe-to-ingredient mapping that turns "bake 150 Everything" into "X kg flour, Y g everything seasoning, …". |
| **The Sysco cycle** | The fixed weekly order/fulfillment timing that the whole forecast is built around (§3). |

---

## 3. Business context & operating rhythm

**Hours:** Open Wednesday–Sunday. Retail window is roughly 4 hours/day *(confirm exact open/close)*. You work 4am–3pm: bake → serve → shape for the next day.

**The weekly Sysco cycle (the timing constraint everything hangs on):**

```
Week N (you're open Wed–Sun)         →  collect actual bake + sales data
   ├─ Thu/Fri of Week N              →  forecast Week N+1, lock the bake plan,
   │                                     generate + submit the Sysco order
   └─ Sat of Week N                  →  Sysco fulfills
Week N+1 (Wed–Sun)                   →  ingredients received are used
```

The hard rule: **next week's forecast must be locked before the Thursday/Friday order deadline.** The app should surface a countdown ("Sysco order due in 2 days") and prevent generating the order until the plan for that week is locked.

**The nightly starter loop (separate, daily):** Each evening, build enough sourdough starter for the *next* baking day's dough, plus a 10% buffer. This runs independent of the weekly cycle and is driven by tomorrow's planned bake quantity.

**Flavors (configurable):** 5 flavors. Known: **Everything** (with house-made everything seasoning) and **Asiago**. *Assumption: the other three are TBD — fill these in Settings.*

**Formats (map to Square items):** Single, 6-Box, 12-Box, Catering Box, Sammie (breakfast sandwich).

---

## 4. System architecture (recommended)

This needs to be a **web app with a backend and a database**, mobile-friendly for 4am data entry. It can't be a pure browser app, because:
- Square and QuickBooks API credentials must live server-side (never in client code).
- Sales need to be pulled on a schedule (a nightly/periodic job), which requires a server.

**Recommended stack (pragmatic, buildable solo):**

| Layer | Recommendation | Why |
|---|---|---|
| Frontend | Next.js (React) + Tailwind | One framework for UI + API routes; mobile-friendly; you've already prototyped in HTML/CSS/JS. |
| Backend/API | Next.js API routes (or a small Node/Express service) | Keeps it in one repo to start. |
| Database | PostgreSQL (e.g. Supabase or Neon) | Relational data (bakes, recipes, inventory) fits SQL; Supabase gives auth + hosted DB fast. |
| Scheduled jobs | Cron (Vercel Cron / Supabase scheduled functions) | Periodic Square sales pulls, low-stock checks. |
| Hosting | Vercel (frontend/API) + hosted Postgres | Low ops overhead. |
| Auth | Supabase Auth or simple email/password | Two-ish users; keep it light. |

*Alternative for a faster, lower-code MVP:* a tool like Airtable or a Retool/Glide front end over Postgres could prove out the data model before committing to a full custom build. Noted as an option, not the recommendation.

**Integrations:**
- **Square API** — read completed orders/sales for per-flavor attribution; optionally read Square's inventory counts. (See §8 for the important detail on how this sidesteps the Thrive limitation.)
- **QuickBooks Online API** — pull purchases/expenses and push or reconcile COGS for financial reporting (Phase 3).

---

## 5. Data model

Core entities and key fields. (Types/constraints to be finalized at build.)

**Flavor**
`id, name, active (bool), default_topping_recipe_id, display_order`

**Format**
`id, name, square_catalog_object_id, bagels_per_unit (Single=1, 6-Box=6, …)`

**ProductMapping** (how a Square sale resolves to flavor + format)
`id, square_variation_id, square_modifier_id (nullable), flavor_id, format_id`

**BakeRecord** (one per baking day)
`id, date, day_of_week, retail_open_time, retail_close_time, total_baked, total_sold, sold_out (bool), sold_out_time (nullable), notes`

**BakeRecordLine** (per flavor within a day)
`id, bake_record_id, flavor_id, qty_baked, qty_sold, flavor_sold_out (bool), flavor_sold_out_time (nullable)`

**WeeklyPlan**
`id, week_start_date, status (draft|locked|ordered), created_by`

**WeeklyPlanDay**
`id, weekly_plan_id, date, day_of_week, planned_total, recommended_total (from forecaster)`

**WeeklyPlanDayLine** (planned qty per flavor per day)
`id, weekly_plan_day_id, flavor_id, planned_qty, recommended_qty`

**Ingredient**
`id, name, category (dough|topping|sammy|packaging|consumable|spread), unit (g, kg, ea, case, …), current_stock, par_level, reorder_point, supplier (sysco|house|other), pack_size, cost_per_unit, sku`

**Recipe** (a named, scalable formula)
`id, name, type (dough|topping|spread|sammy|seasoning|starter), yield_unit, yield_qty, notes`

**RecipeComponent** (an ingredient OR a sub-recipe used by a recipe — supports nesting, e.g. dough → starter, Everything bagel → everything seasoning sub-recipe)
`id, recipe_id, ingredient_id (nullable), sub_recipe_id (nullable), quantity, unit, is_bakers_pct (bool)`

**StarterLog** (nightly)
`id, date, qty_needed_tomorrow, buffer_pct (default 10), qty_to_build, qty_built (actual), notes`

**SyscoOrder**
`id, weekly_plan_id, submit_due_date, submitted_at, status`

**SyscoOrderLine**
`id, sysco_order_id, ingredient_id, qty_needed, qty_on_hand, qty_to_order, pack_size, est_cost`

Relationships in brief: a `WeeklyPlan` has `WeeklyPlanDay`s → each has `WeeklyPlanDayLine`s (per flavor). Recipes explode (via `RecipeComponent`, including nested sub-recipes) into `Ingredient` demand. That demand, netted against `Ingredient.current_stock`, produces the `SyscoOrder`. This is essentially lightweight **MRP (material requirements planning)** for the bakery.

---

## 6. Modules

Each module below: purpose → key screens → functional requirements (IDs) → acceptance criteria.

### 6.1 Dashboard / Home (`HOME`)
**Purpose:** At-a-glance state of the business and the things that need action today.

**Shows:**
- Today's bake vs sold so far (live from Square), with per-flavor sold-out indicators.
- Alerts: low/at-reorder ingredients; Sysco order due countdown; tonight's starter build amount.
- This week's plan status (draft / locked / ordered).
- Quick KPIs: 7-day sell-through %, waste this week, sold-out days this week.

**Requirements:**
- `HOME-1` Surface "Sysco order due in N days" whenever the current week's plan is not yet `ordered` and the deadline is within the alert window.
- `HOME-2` Show tonight's starter build quantity (from §6.6) prominently after a configurable hour (e.g. after 12pm).
- `HOME-3` One-tap links into each module's primary action.

**Acceptance:** Opening the app at 4am shows today's plan and tonight's starter amount without navigation.

---

### 6.2 Daily Bake & Sales Tracking (`BAKE`)
**Purpose:** The morning data-entry surface and the source of all historical truth.

**Key screens:**
- **Morning entry:** per-flavor "baked today" inputs, auto-summing to total. Big mobile-friendly number steppers (you're entering this at 4am).
- **Live sales view:** per-flavor sold (pulled from Square), remaining = baked − sold, with a visual bar per flavor.
- **Sold-out marking:** mark a flavor (or the whole day) sold out; capture the timestamp.

**Requirements:**
- `BAKE-1` Enter quantity baked per flavor each morning; total baked computed automatically.
- `BAKE-2` Pull sold quantities per flavor from Square on a schedule and on-demand refresh (see §8 for attribution logic).
- `BAKE-3` Allow marking sold-out per flavor and for the day; **auto-detect** sold-out when sold reaches baked and record the timestamp; allow manual override of the time.
- `BAKE-4` Compute and store sell-through % and leftover (waste) per flavor and total at close.
- `BAKE-5` Capture retail open/close times per day (defaults configurable, editable).
- `BAKE-6` Record optional notes (weather, events, local closures) — these are useful forecasting context later.

**Acceptance:** For any past date, the app can show what was baked, what sold, whether/when it sold out, and the leftover, per flavor and in total.

---

### 6.3 Production Planning & Forecasting (`PLN`)
**Purpose:** Plan next week's bake per day and per flavor, informed by same-weekday history. This is the calibration brain.

**Key screens:**
- **Week planner:** a Wed–Sun grid for the target week. Each day has a planned total + per-flavor breakdown, pre-filled with the forecaster's recommendation (editable).
- **Day detail (the one you described):** click a day (e.g. a Wednesday) → see the **last 8 occurrences of that weekday (~2 months)** as a table/chart: date, total baked, total sold, sold-out (Y/N), sold-out time. Plus a per-flavor breakdown of the same. Below it, the recommended bake total and per-flavor split with the reasoning.

**Requirements:**
- `PLN-1` For a selected weekday, display the trailing 8 same-weekday bake records (baked, sold, sold-out flag, sold-out time), total and per-flavor.
- `PLN-2` Produce a recommended **total** bake quantity for that weekday using the forecasting methodology in §7 (which accounts for sold-out/censored days).
- `PLN-3` Produce a recommended **per-flavor split**, calibrated from per-flavor sell-through and per-flavor sold-out history (some flavors sell out while others linger → rebalance the mix).
- `PLN-4` Let the user override any recommended number; store both `recommended_qty` and `planned_qty` so we can later measure forecast accuracy.
- `PLN-5` Plan the full target week (all open days) in one view; **lock** the week to feed the recipe and ordering modules.
- `PLN-6` Show forecast vs actual after the fact (was the recommendation good?), to improve trust over time.

**Acceptance:** Selecting "Wednesday" shows the prior 8 Wednesdays and a defensible recommended total + flavor split; the planner can lock a full week.

---

### 6.4 Recipe & Prep (`RCP`)
**Purpose:** Turn the locked weekly plan into "here's exactly what to prep each day."

**Key screens:**
- **Day prep sheet:** for a selected day, total dough needed and its ingredient breakdown (flour, honey, salt, starter), topping quantities per flavor (including house everything-seasoning amount), and any spread/sammy prep for that day.
- **Weekly prep rollup:** total cream cheese to prep for the week, total everything seasoning to batch, total sammy components, etc.

**Requirements:**
- `RCP-1` Read the locked `WeeklyPlan` and explode it into ingredient quantities via recipes/BOM (§5), including **nested sub-recipes** (dough uses starter; Everything bagel uses the everything-seasoning sub-recipe).
- `RCP-2` Express dough as **baker's percentages** so it scales exactly with the day's bagel count.
- `RCP-3` Show per-day dough requirement and per-day topping requirements per flavor.
- `RCP-4` Show the **weekly total cream cheese** (and each spread variety) to batch-prep, driven by forecasted sammy + retail spread demand.
- `RCP-5` All recipes are editable in Settings and versioned (so changing a recipe doesn't silently rewrite history).

**Acceptance:** Given a locked week, the module outputs a correct per-day prep sheet and a weekly cream-cheese/seasoning total without manual math.

---

### 6.5 Inventory Management (`INV`)
**Purpose:** Formalize the "it's all in my partner's head" system into a written, referenceable, alerting inventory.

**Categories (broken out as you described):**
- **Dough ingredients:** flour, honey, salt, starter.
- **Topping ingredients:** everything seasoning *(itself a recipe of the component spices/seeds — poppy, sesame, dried garlic, dried onion, salt, etc.)*, asiago, and other per-flavor toppings.
- **Breakfast sandwich (sammy) ingredients:** bacon, eggs, cheese, etc.
- **Spreads:** cream cheese base + mix-ins.
- **Packaging:** boxes (6/12/catering), bags, sammy wrap, labels, etc.
- **Consumables:** anything else recurring.

**Requirements:**
- `INV-1` Maintain current stock, unit, par level, and reorder point per ingredient, grouped by category.
- `INV-2` Flag items at or below reorder point ("order this week").
- `INV-3` Support quick stock-count entry (a weekly count screen by category).
- `INV-4` Optionally decrement projected stock based on the week's recipe explosion (theoretical usage), to compare against counted stock and surface variance/waste.
- `INV-5` Store supplier (Sysco / house-made / other), pack size, and cost per unit to support ordering and COGS.

**Acceptance:** A weekly count can be entered by category; the app lists what's below reorder point; nothing critical lives only in someone's head.

---

### 6.6 Sourdough Starter Management (`STR`)
**Purpose:** Tell you each evening how much starter to build for the next baking day, with a 10% buffer.

**The calculation:**
```
flour_needed_tomorrow   = tomorrow's planned bagels  ×  flour per bagel (from dough recipe)
starter_needed_tomorrow = starter % (of flour, from dough baker's %)  ×  flour_needed_tomorrow
starter_to_build        = starter_needed_tomorrow  ×  (1 + buffer)      // buffer default 10%
```

**Requirements:**
- `STR-1` Each evening, compute starter-to-build from the next baking day's locked/planned bagel count and the dough recipe's starter percentage.
- `STR-2` Apply a configurable buffer (default **10%**).
- `STR-3` Log planned vs actual built per night (`StarterLog`), so feeding can be tuned over time.
- `STR-4` Account for non-consecutive days (Sunday's build must cover Wednesday's bake, since you're closed Mon/Tue) — the "next baking day" is the next *open* day, not literally tomorrow.

**Acceptance:** On any evening, the app states a single number ("build X g of starter tonight") that already includes the buffer and points at the correct next open day.

*Note: you trailed off on an additional starter idea ("Also tracking, yeah, no, never mind"). Flagging here in case you want to pick it back up.*

---

### 6.7 Ordering — Sysco (`ORD`)
**Purpose:** Generate the weekly Sysco order from the forecast, on the correct timing.

**Requirements:**
- `ORD-1` Generate a draft order = (week's recipe-exploded ingredient demand) − (current on-hand stock), rounded up to Sysco pack sizes.
- `ORD-2` Group the order by category/supplier and show estimated cost.
- `ORD-3` Enforce the cycle: the order is built for the **following** week and must be ready before the Thu/Fri deadline; show the countdown and block "mark ordered" until the corresponding `WeeklyPlan` is `locked`.
- `ORD-4` Let the user edit quantities (judgment override) before marking submitted; record submitted date.
- `ORD-5` On the next stock count, support reconciling received vs ordered.

**Acceptance:** By Thursday, with next week's plan locked, the app produces a categorized, pack-rounded, costed order ready to submit to Sysco.

---

### 6.8 Reporting & Analytics (`RPT`)
**Purpose:** The detailed reporting you want, combining Square (sales) and QuickBooks (financials).

**Reports:**
- Sell-through and sold-out frequency by weekday and by flavor over time.
- Waste (leftover) by day/flavor, in units and in cost.
- Forecast accuracy (recommended vs planned vs actual).
- Food cost % and gross margin (Square revenue vs QuickBooks/ingredient COGS).
- Demand-curve view: what time of day each weekday sells, from Square order timestamps (feeds §7).

**Requirements:**
- `RPT-1` Filter all reports by date range, weekday, flavor, and format.
- `RPT-2` Pull revenue/sales from Square and expense/COGS from QuickBooks; reconcile into margin.
- `RPT-3` Export to CSV.

**Acceptance:** You can answer "what's our Wednesday waste cost trend?" and "what's our food cost % this month?" without a spreadsheet.

---

### 6.9 Settings / Configuration (`CFG`)
- Manage flavors, formats, and Square product mappings (variation/modifier → flavor + format).
- Manage recipes (dough baker's %, toppings, spreads, sammy builds, everything-seasoning sub-recipe, starter %), with versioning.
- Manage ingredients, categories, par/reorder levels, suppliers, pack sizes, costs.
- Set hours, order deadline day, starter buffer %, alert windows.
- Manage Square and QuickBooks connections (OAuth).

---

## 7. Forecasting methodology (deep dive)

This is the part that makes the "how many to bake" tab actually smart. The naïve approach — "average what we sold on the last 8 Wednesdays" — is **wrong on the days that matter most**, because of censored demand.

**The censored-demand problem.** On a day that did *not* sell out, `sold ≈ true demand` (anyone who wanted one got one). On a day that *did* sell out, `sold = baked`, but true demand was *higher than baked* — you just don't know by how much. Averaging "sold" therefore **systematically underestimates demand on your best days** and tells you to keep underbaking exactly when you're leaving money on the table. Your Thursday (sold out in 2.5 of ~4 hours) is the textbook case.

**Recommended approach:**

1. **Classify each historical same-weekday record** as *uncensored* (didn't sell out → `demand = sold`) or *censored* (sold out → `demand > baked`).

2. **Estimate demand on censored days** using the sold-out time and an intraday demand curve:
   - Quick version (linear): if you baked 150 and sold out at 2.5h of a 4h window, naïve linear demand ≈ `150 × (4 / 2.5) = 240`. Linear *overstates* it because mornings are front-loaded, so treat this as a loose upper bound.
   - Better version (demand curve): build the typical cumulative-sales-by-hour curve for that weekday from Square order timestamps (`RPT` demand-curve view). If history shows ~75% of the day's sales normally land by hour 2.5, then `estimated demand ≈ baked / 0.75 = 200`. This is far more credible than linear.

3. **Set the recommended total** to a target service level — e.g. bake enough to satisfy demand on ~80–90% of comparable days. Concretely: take the (de-censored) demand estimates across the trailing 8 same-weekdays, and recommend around a high percentile of that distribution, nudged by a tolerance for waste. Two knobs the user can set: **target sell-out rate** (how often you're OK selling out) and **acceptable waste**.

4. **Per-flavor split (`PLN-3`).** Within the recommended total, allocate by each flavor's de-censored demand share, not by what was baked. Flavors that repeatedly sell out get a larger share; flavors that consistently leave leftovers shrink. Track per-flavor sold-out times the same way as the day total.

5. **Trend & seasonality.** Weight recent weeks a bit more than older ones (e.g. exponential weighting over the 8 occurrences). Use the notes field (`BAKE-6`) and a calendar to flag anomalies (holidays, events, road closures) so they don't pollute the baseline.

6. **Close the loop (`PLN-6`).** Always store recommended vs planned vs actual so the model's accuracy is visible and tunable. Start simple (the de-censored percentile method above); only add complexity if the data warrants it.

**Build note:** ship a transparent, explainable rule first ("recommended 175 because de-censored demand on the last 8 Wednesdays averaged ~160 with two sell-outs; targeting your 85% service level"). An explanation you trust beats a black box.

---

## 8. Integrations detail

### Square — and why this finally solves the Thrive problem
The wall you hit with Thrive was that Square **does not enforce inventory at checkout for modifiers** — so it couldn't decrement flavor-level stock as orders came in. This app **doesn't need it to.** We're not trying to block a sale at the register; we're doing **post-hoc attribution**: read completed orders from the Square Orders/Payments API after the fact, and attribute each line item to a flavor + format using the `ProductMapping` table (§5). Whether a flavor is modeled as a Square *variation* or a *modifier*, it's present on the completed order and readable. So the same modifier structure that Thrive couldn't act on is perfectly usable for our reporting and forecasting.

**Requirements:**
- `INT-1` Connect to Square via OAuth; store tokens server-side.
- `INT-2` Periodically (and on-demand) pull completed orders for the open window and attribute line items to flavor + format via `ProductMapping`.
- `INT-3` Capture per-line **timestamps** to build the intraday demand curve (§7).
- `INT-4` Handle the mapping-not-found case gracefully (surface unmapped items in `CFG` to be mapped).
- `INT-5` Optionally read Square inventory counts where useful, but treat the app's own inventory module as the source of truth for ingredients (Square inventory is at the product level, not ingredient level).

### QuickBooks Online (Phase 3)
- `INT-6` Connect via OAuth; pull expenses/bills (including Sysco invoices) and revenue to compute food cost % and margin in `RPT`.
- `INT-7` Map ingredient purchases to categories so COGS lines up with the inventory model.

**Confirm against current API docs at build time** — Square and QuickBooks endpoints, scopes, and rate limits change; this spec describes capabilities, not exact endpoints.

---

## 9. Phased roadmap

**Phase 1 — Prove the loop (highest value, smallest build)**
- `CFG` minimal: flavors, formats, Square product mapping.
- `BAKE`: morning entry + Square sales pull + sold-out marking + sell-through/waste.
- `PLN`: trailing-8 weekday view + transparent forecaster (de-censored percentile) for total and per-flavor.
- `HOME`: today's status + order-due countdown.
*Outcome: you can calibrate daily bakes from real data — the core thing you asked for.*

**Phase 2 — Plan to plate**
- Full `CFG` recipes (baker's %, toppings, everything-seasoning sub-recipe, spreads, sammies, starter %).
- `RCP` prep sheets + weekly cream-cheese rollup.
- `INV` inventory + reorder flags.
- `STR` nightly starter calc.
- `ORD` Sysco order generation on the weekly cycle.
*Outcome: the forecast drives prep, inventory, starter, and the order automatically.*

**Phase 3 — Full reporting**
- QuickBooks integration; food cost %, margin, COGS reconciliation.
- Advanced `RPT`: forecast accuracy, waste-cost trends, intraday demand curves.

---

## 10. Open questions & assumptions (confirm before building)

1. **Flavors:** Confirm the 5 flavors (known: Everything, Asiago). Needed for `CFG`/recipes.
2. **Hours:** Exact retail open/close per day. The 4-hour window and sold-out-time math depend on it.
3. **Sysco specifics:** Confirm supplier name (assumed Sysco), exact order day, and how pack sizes are defined (so `ORD` rounds correctly).
4. **Square product structure:** Are flavors variations, modifiers, or separate items today? Drives `ProductMapping`.
5. **Dough recipe:** The actual baker's percentages and flour-per-bagel weight (needed for `RCP` and the starter calc).
6. **Starter:** The dough's starter percentage and your feeding ratio; plus whatever the trailed-off idea in `STR` was.
7. **Users:** How many people use this, and do they need different permissions?
8. **Build vs low-code:** Custom Next.js + Postgres (recommended) vs an Airtable/Retool MVP first?

---

## 11. Idea log / changelog

*Append new ideas here as they come; this section is the running log.*

- **2026-06-18 — v0.1 created.** Captured: (a) per-flavor morning bake entry + Square-driven sold tracking + sold-out marking with timestamps, for weekday/flavor calibration [`BAKE`, `PLN`]; (b) weekly planning with trailing-8 same-weekday view and trend-based recommendation [`PLN`]; (c) recipe/prep module derived from the locked plan, incl. weekly cream-cheese total [`RCP`]; (d) categorized inventory replacing the in-head system [`INV`]; (e) forecast-before-Sysco-order weekly cycle [`ORD`]; (f) nightly sourdough starter calc with 10% buffer [`STR`]. Open: trailed-off starter idea to be recovered (§6.6 note).
