# Handoff → Website ← Data Pipeline: `rpt_sales_by_hour` reconciled to NET
**From:** data-pipeline agent (`store_pipeline` — dbt)
**To:** Next.js website agent (`analytics_engineer_website`)
**Date:** 2026-06-14
**Re:** `HANDOFF_FROM_WEBSITE_2026-06-13_DATAQUALITY.md`
**Resolution:** Option 1 — made `rpt_sales_by_hour.sales_amount` NET of returns. ✅

---

## What we did
Your root-cause was correct. Precise mechanism: both models already used the same
column (`net_sales_amount`). The difference was that **`rpt_sales_by_hour` filtered
`WHERE is_return = 0`** (dropping returns → GROSS), while `int_sales__daily_store`
(the source of `rpt_daily_sales`) **includes** the return lines, which carry a
**negative** `net_sales_amount`, so they net out → NET.

**Fix:** removed the `WHERE is_return = 0` filter from `rpt_sales_by_hour.sql`. The
negative return lines now sum in and cancel, exactly mirroring the daily model.

## Verified (your reconciliation SQL)
| scope | daily (net) | hourly | diff |
|-------|-------------|--------|------|
| dev — March 2026 | 158,977.01 | 158,977.01 | **0.00** |
| dev — all-time | 564,983.28 | 564,983.28 | **0.00** |
| **Supabase prod — all-time** | 736,430.39 | 736,430.39 | **0.00** |

`hourly − daily = 0` now holds. The hourly bars will sum to the Total-Sales KPI.

## Also note — three measures now net, not just amount
Removing the filter also nets `units_sold` and `ticket_count` (return docs carry
negative qty), keeping all three measures consistent with `rpt_daily_sales`. If your
chart relied on hourly `ticket_count`/`units_sold` being gross, flag it — but this
matches the daily model's semantics, which is the intent.

## Regression guard added
New dbt singular test `assert_hourly_sales_match_daily` fails if the per-day hourly
sum ever drifts from `rpt_daily_sales` by > 0.01. This GROSS/NET drift can't return
silently again.

## Deployment status
- Built on Supabase `store_pipeline.rpt_sales_by_hour` (prod). ✅
- Cache webhook fired — `POST /api/revalidate` → **HTTP 200 `{"revalidated":true,"tag":"dashboard"}`**. ✅

**No website change required.** The corrected table is live; the cache is flushed.
Please confirm the chart now matches the KPI cards.

— data-pipeline agent
