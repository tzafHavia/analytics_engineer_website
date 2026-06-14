# Handoff → Website ← Data Pipeline: inventory snapshot now history-backed
**From:** data-pipeline agent (`store_pipeline` — dbt)
**To:** Next.js website agent (`analytics_engineer_website`)
**Date:** 2026-06-15
**Type:** Dashboard data improvement (no breaking schema change) — heads-up + 1 bug fix.

---

## What changed (and why it's better)
The inventory snapshot is now backed by a real per-business-day history table
(`fct_inventory_snapshot_history`) instead of a single `current_date`-stamped row.

### 1. `rpt_executive_summary_daily` — inventory columns now POPULATED (bug fix)
**Before:** `out_of_stock_count`, `stockout_risk_count`, `dead_stock_count`,
`overstock_count`, `inventory_items_count`, `avg_days_of_cover_30d` were **NULL on
virtually every day**. Root cause: inventory was stamped with `current_date`, which
almost never equals a `sale_date` in the data, so the join produced no match.

**After:** these columns are now populated for **26 days** (every day the history
covers — 2026-03-21 → 2026-04-15). Older days remain NULL (no snapshot exists that
far back). This grows as the backfill loop accumulates more days.

➡️ **Action for you:** if any KPI card / chart previously hid or coalesced these as
"no data", they now have real values for recent days. No schema change — same columns.

### 2. `rpt_inventory_risk` / `rpt_product_velocity` — unchanged shape
Same columns, same grain. Only difference: `snapshot_date` is now a real **business
date** (e.g. 2026-04-15) instead of a wall-clock `current_date`. If your UI displays
"inventory as of {snapshot_date}", it will now show the latest business day — which is
more correct. No code change needed on your side.

## Schema impact
**None breaking.** No columns added/removed/renamed on any `rpt_*` table. This is a
data-population + date-semantics improvement only.

## Deployment status
- Built on Supabase `store_pipeline`: `fct_inventory_snapshot`, `rpt_inventory_risk`,
  `rpt_product_velocity`, `rpt_executive_summary_daily`. ✅
- Cache webhook: attempted; hit an intermittent local OpenSSL crash on our machine
  (it succeeded earlier today). **Please trigger a revalidate** (or rely on ISR) to
  pick up the refreshed `store_pipeline` tables. The tag is `dashboard`.

## Verify (Supabase)
```sql
-- now ~26 days have inventory counts (was ~0):
select count(*) total,
       count(inventory_items_count) with_inventory
from store_pipeline.rpt_executive_summary_daily;
```

— data-pipeline agent
