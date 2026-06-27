# Dashboard Redesign Plan — 2026-06-27

**Purpose:** define, per tab, **what** it shows, **why** (the decision it supports), and **who**
it's for — then lay out the redesigned layout integrating the `FIXES_FOR_AGENT` recommendations.
**Backup before changes:** `backups/dashboard_2026-06-27/`.
**Fix details & agent split:** `DASHBOARD_FIXES_PLAN_2026-06-27.md`.

**Audiences (portfolio personas):**
- **SM** = Store Manager (operational decisions: ordering, staffing, pricing).
- **OWN** = Owner / exec (health at a glance, trust in the numbers).
- **REV** = Portfolio reviewer / hiring manager (judges analytical maturity & clarity).

**Cross-cutting design rules (apply to every tab):**
1. **Lead with the decision** — top element answers "what do I do?", analysis supports below.
2. **Every chart gets a one-line "so what" caption** (#6).
3. **Every KPI card gets a WoW direction chip** (#10).
4. **Cap tables at top 10–15 + "show all"** (#8).
5. **One definition per metric**, scope labelled where it legitimately differs (#2).
6. **Integers for counts; ₪ rounded; RTL `dir` on Hebrew names** (#1).

---

## Tab 1 — Overview  ·  audience: OWN, REV
**What:** the 60-second health check — sales trend, top products, inventory split, recent days.
**Why:** "is the store healthy and is this dashboard trustworthy?" (REV forms their first
impression here; OWN wants reassurance).
**Redesign:**
- KPI strip: all cards get WoW chips (#10); units integer (#1); "Avg days of cover" uses the
  **same definition** as Inventory or is explicitly scope-labelled (#2).
- Trend charts keep Line/Bar toggle; add captions ("Sales up X% WoW; weekends peak") (#6).
- Optional: sparkline inside each KPI card (#11).
- Keep it short — this is the summary, not the deep dive.

## Tab 2 — Sales  ·  audience: SM, OWN
**What:** revenue dynamics — daily/avg-ticket trends, sales by hour, payment mix, returns.
**Why:** SM decisions on staffing windows, promotions, payment handling; OWN tracks revenue.
**Redesign:**
- Fix decimal units (#1).
- Sales-by-hour caption: "Busiest 11:00–15:00 — staff accordingly" (#6).
- **Returns:** add **return-rate** (returns ÷ sales per product) beside absolute returns so
  high-volume items don't dominate (#13).
- *(Stretch, needs data)* hour×weekday **heatmap** replacing/ą augmenting the hour bar (#12).

## Tab 3 — Inventory  ·  audience: SM (primary)
**What:** what to reorder now, what's overstocked/dead, stock-health over time.
**Why:** the most **action-dense** tab — SM places orders off this.
**Redesign (biggest structural change):**
1. **Lead with the action plan** — "Reorder now" table at the **top** (#9), capped to top 15
   with "show all" (#8), **junk rows filtered** (#4).
2. Then KPI strip (unify dead-stock & days-of-cover definitions, #2).
3. Then the analytical support: health-trend, donut, histogram, scatter — each with a caption
   (#6) and **quadrant labels** on the inventory-vs-sales scatter ("overstocked", "reorder")
   (#14).
4. Surface the **"worst offenders" interactive table** (`rpt_item_stockout_days`) here — the
   chronically-unavailable products drill-down (ties to WORK_PLAN R2).

## Tab 4 — Products & Categories  ·  audience: SM, OWN
**What:** which products/categories drive revenue and margin.
**Why:** pricing, range, and promotion decisions; spotting high-sales/low-margin items.
**Redesign:**
- **Replace the treemap** (one tile = ~66%, unreadable) with a **sorted horizontal bar of
  gross profit** (#7) — margin leaders ≠ revenue leaders is the better story.
- Rename the "dead stock" count to **"slow & dead movers"** with its scope (#2).
- GP scatter: **quadrant labels** ("high sales / low margin → review pricing") + caption (#6,#14).
- Cap the product/category tables (#8).

## Tab 5 — Workforce  ·  audience: OWN, SM, REV
**What:** per-employee hours, overtime, attributed sales, efficiency; team podium.
**Why:** labour-cost and productivity decisions; REV values the honest attribution caveat.
**Redesign:**
- **Fix the reconciliation (#3) first** — make the period explicit and consistent with Sales,
  fix/verify the hour-share partition so figures are defensible.
- Keep the attribution disclaimer (#16 — already present).
- Per-employee trend already uses attributed sales (distinct per employee) — add a caption (#6).
- *(Stretch, needs data)* **Workforce↔Sales cross-link**: sales-per-labour-hour vs hourly
  traffic — "are we staffed when it's busy?" (#15) — the single most valuable cross-view add.

---

## Build approach
- Work **tab by tab**, Phase A (correctness) across all tabs first so no view shows a wrong
  number, then Phase B/C polish per `DASHBOARD_FIXES_PLAN`.
- After each tab: `npm run build` + visual check + checkpoint commit (tag `dashboard-v1` exists
  as the rollback point).
- Reusable pieces to add once and share: `ChartCaption`, `KpiDeltaChip`, `ShowAllTable`
  wrapper, `ScatterQuadrantLabels` — keeps the work DRY across tabs.
