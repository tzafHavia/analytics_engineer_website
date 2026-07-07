# Frontend P1 "correctness & credibility" fixes — Work Plan (2026-07-06)

**Branch:** `feature/dashboard-rich` (clean base; hero animation archived on `feature/anim`, commit `21e78e5`).
**Source:** `WEBSITE_HANDOFF_p1_definition_fixes_2026-07-02.md` (data #2/#3/#4) + FIXES #1 (display, our side).
**Prod status (verified 2026-07-06):** the two new columns are ALREADY LIVE in prod — nothing blocked:
`rpt_inventory_health_trend` + `rpt_executive_summary_daily` each have `median_days_of_cover_30d` and
`no_recent_sales_count`.

## The 5 fixes
- **#1** Units render with decimals → round to integers (display only).
- **#2a** Headline **median** days of cover (`median_days_of_cover_30d`) on Overview + Inventory; keep the
  mean only if labelled "average (skewed by overstock)".
- **#2b** Split **`no_recent_sales_count`** vs `dead_stock_count`; label each card to its column.
- **#3** Workforce attributed-sales must honour the **same global date filter** as the Sales view (window
  mismatch, not a double-count). If a card is intentionally all-time, label it so.
- **#4** `dim_product` placeholders changed → update filters: `'Unknown Item'`→`'(unmapped item)'`,
  `'Uncategorized'`→`'(uncategorized)'`; sort real items first (group placeholders, don't top the list).

## FIELD-NAME CONTRACT (both agents build to this — parallel-safe)
Backend ONLY ADDS these; it must NOT rename existing fields (`avgDaysOfCover`, `deadStockCount` stay).
- `fetchInventoryDashboardData().kpis.medianDaysOfCover` — from `rpt_inventory_health_trend.median_days_of_cover_30d` (latest snapshot)
- `fetchInventoryDashboardData().kpis.noRecentSalesCount` — from `rpt_inventory_health_trend.no_recent_sales_count` (latest snapshot)
- `fetchOverviewDashboardData()` → `medianDaysOfCover` alongside the existing `avgDaysOfCover` (from `rpt_executive_summary_daily`)

## Division of work
### backend-engineer — `lib/dashboardData.js` ONLY (data layer)
- #2a/#2b: add the median + no-recent-sales columns to the inventory and overview fetches → expose the
  contract fields above (add-only).
- #4: update the SQL placeholder filters (lines ~629/651/669/1714 use `'unknown item'`) to the new
  `'(unmapped item)'` / `'(uncategorized)'` strings so junk stays excluded/handled as before.
- #3: make the workforce attributed-sales honour `dateFrom/dateTo`; if the all-time summary table can't be
  windowed, expose an explicit all-time flag so the UI can label it. Report what you did.

### dashboard-engineer — `components/*` ONLY (display)
- #2a: Inventory + Overview headline "days of cover" KPI → `medianDaysOfCover` ("Median days of cover");
  relabel the mean card "Avg days of cover (skewed by overstock)".
- #2b: dead-stock vs no-recent-sales cards labelled to the right value (`deadStockCount` vs `noRecentSalesCount`).
- #1: round unit values (units/qty) to integers across KPI cards + tables.
- #4: sort real items first — push `(unmapped item)`/`(uncategorized)` rows to the bottom / group them.

### orchestrator (me)
- Sequence + supervise, integrate, `npm run build` + smoke (5 tabs + Hebrew filter HTTP 200), USER GATE,
  then promote to `main` on owner go.

## Notes
- No new tables; same 20-object read-set. No allowlist change.
- Data-layer #3 date honouring must not change the resting/all-time behaviour without a label.
