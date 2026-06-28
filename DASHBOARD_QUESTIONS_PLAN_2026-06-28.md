# Dashboard Questions — Work Plan (2026-06-28)

**Source:** `dashboard_questions.md` (owner review of the Round-2 dashboards).
**Method:** every item investigated against the live code + DB before planning.
**Companions:** `DASHBOARD_FIXES_ROUND2_2026-06-27.md`, `DASHBOARD_REDESIGN_PLAN_2026-06-27.md`.

---

## Answers to the two questions (no code — findings)

- **Q1 — Filters working?** Product-category & Item filter the **Overview tab only**
  (`isScoped` branch, dashboardData.js:182). **Stock-status & Velocity-band filter NOTHING**
  anywhere — rendered + echoed as chips but never used in SQL. → see **T1**.
- **Q4 — Workforce labour hours differ at 14/15/16?** Not a bug. `labour_hours` is allocated by
  minute-precision shift-overlap over ~187 days; 14:00 dips (clock-outs/breaks, headcount 0.97),
  15:00–16:00 rise (shift-handover overlap, headcount 1.03). → optional explainer tooltip (**T6**).

---

## Tasks

### T1 — Stock-status & Velocity-band filters (Overview) — **DECISION D1**
They currently do nothing. Options: (a) **wire them** to scope the Overview's product/inventory
blocks, (b) **remove** them from the global panel, (c) **relocate** them to Inventory/Products tabs
where they're semantically meaningful. Owner = backend-engineer (SQL) + dashboard/ui (panel).

### T2 — Cascading Category → Item filter (Overview, item 2)
When a category is selected, the **Item** datalist shows only items in that category. Today
`itemNames` is a flat global list. Plan: filter-options expose **item→category mapping**; the
`OverviewFilters` client component filters the datalist by the selected category (client-side, no
reload). Owners = backend-engineer (options shape) + dashboard-engineer (cascading UI).

### T3 — Category filter on "Top 10 products by revenue" (Overview, item 3) — **DECISION D2**
Add a category selector to the Top-Products chart so the top 10 are scoped to a category.
Approach choice in D2 (client-side filter of a larger fetched pool vs server-side re-query).
Owners = backend-engineer (data) + dashboard-engineer (control).

### T4 — Category filter on "Top returning products" (Sales, item 6)
Add a category dropdown above the returns table (categories: כללי / אביזרי רכב / סיגריות / אלכוהול /
חטיפים / …, populated from `product_category_name`). Same approach as D2. The returns query already
selects `product_category_name`. Owners = backend-engineer (data/filter) + dashboard-engineer (control).

### T5 — Daily attributed sales → stacked bar by employee (Workforce, item 5) — **DECISION D3**
Replace the current daily-attributed-sales view with a **stacked bar** (x = day, segments =
employees, colour per person). Buildable now from `rpt_employee_productivity`
(`shift_date × employee_id × sales_amount`). The requested **"lower segment = morning shift"**
needs a **shift-type field that does not exist** in the mart → data-agent dependency (D3).
Owners = backend-engineer (per-day per-employee series) + dashboard-engineer (stacked chart,
Hebrew RTL names). Colours per employee from the existing workforce palette.

### T6 — Labour-hours explainer (Workforce, item 4) — optional
Small tooltip/caption on the Staffing-vs-Sales chart explaining the mid-afternoon
shift-overlap effect. Owner = dashboard-engineer (or ui-designer for tooltip style).

---

## Decisions for the owner
- **D1 (stock/velocity filters):** wire up / remove / relocate to Inventory+Products?
- **D2 (per-chart category filters, T3+T4):** client-side (snappy, filters a pre-fetched pool) vs
  server-side via URL param (accurate top-N per category, adds a reload)?
- **D3 (morning/evening shift, T5):** build stacked-by-employee now + request a shift-type field
  from the data agent for the morning/evening layering later, OR wait for the data and do it once?

## ✅ EXECUTION LOG — 2026-06-28 (build clean, lint clean, backend DB-verified)

Decisions: **D1** = relocate stock/velocity to Inventory+Products · **D2** = client-side dropdowns ·
**D3** = build stacked-by-employee now; shift start time is NOT in any `rpt_*` table, so the
morning/evening split needs the data agent → `PIPELINE_HANDOFF_shift_split_2026-06-28.md`.

| T | Done | Notes |
|---|---|---|
| Q1 | ✅ answered | category/item filter Overview only; stock/velocity filtered nothing → fixed via T1. |
| Q4 | ✅ answered + T6 | mid-afternoon labour-hours variance = real shift-overlap; explainer added. |
| T1 | ✅ | Stock/velocity removed from global panel; new `TabFilterBar` on Inventory (stock+velocity) & Products (velocity+stock); backend now consumes them (UPPERCASE enums) on item-level queries. Aggregate KPIs/donut left whole by design. |
| T2 | ✅ | `itemsByCategory` from backend; `OverviewFilters` item datalist now cascades from selected category (clears stale item). |
| T3 | ✅ | Overview top-products pool widened to 50 w/ category; `OverviewTopProductsChart` gets opt-in `enableCategoryFilter` (Overview only) → client dropdown, top 10 of category. |
| T4 | ✅ | Returns pool widened to 50; new client `ReturnsTable` w/ Hebrew category dropdown, top 20 of category. |
| T5 | ✅ (partial) | New `DailyEmployeeSalesChart` — stacked bar by employee (RTL tooltip/legend, per-person palette); replaced the old `EmployeeTrendChart` daily-attributed view (file kept, unused). **Morning/evening layering pending data** (handoff sent). |
| T6 | ✅ | `od-info-badge` "ⓘ" + note on staffing chart explaining the shift-overlap effect. |

**Carried (data-dependent):** morning/evening shift split for T5 — waiting on
`rpt_employee_sales_by_shift_part` (or morning/evening columns) per the handoff.

## Agent ownership
- **backend-engineer** — filter-options mapping (T2), per-chart category data (T3/T4), per-day
  per-employee series (T5), and the stock/velocity SQL if D1=wire.
- **dashboard-engineer** — cascading UI (T2), chart category controls (T3/T4), stacked bar (T5),
  explainer (T6), panel changes for D1.
- **ui-designer** — filter/control styling, tooltip style, light-theme safety.
- **data agent (separate repo)** — shift-type field for T5 if D3 = layered.
