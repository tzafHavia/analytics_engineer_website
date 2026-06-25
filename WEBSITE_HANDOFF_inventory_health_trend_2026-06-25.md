# Website Handover — Inventory Health Trend Report

**Date:** 2026-06-25
**From:** data pipeline (dbt / store_pipeline)
**To:** portfolio website agent (Next.js dashboard on Vercel)
**Status:** model built + tested on dev/prod; deployed to Supabase (see §7)

---

## 1. TL;DR — what's new

The pipeline now keeps a **per-business-day inventory time-series**, and a new
dashboard table summarizes it as a **trend over time**:

> **`store_pipeline.rpt_inventory_health_trend`** — one row per business day, with
> per-status item counts (out-of-stock, stockout-risk, dead-stock, overstock,
> healthy), an "at-risk" total, average days-of-cover, and rolling-7-day /
> week-over-week context.

This is the **first time-series** in the inventory domain. Every other inventory
report (`rpt_inventory_risk`, `rpt_inventory_actions`, `rpt_product_velocity`) is a
**snapshot of the latest day only** — this one shows the **direction** the store's
stock health is moving. It's ideal for a **line/area chart** ("inventory health over
time") rather than a table.

---

## 2. Where it lives

| | |
|---|---|
| Database | Supabase Postgres (prod) |
| Schema | `store_pipeline` |
| Table | `rpt_inventory_health_trend` |
| Grain | **one row per business day** (`snapshot_date`) |
| Current depth | **96 days** (2026-03-21 → 2026-06-24), grows by one row per nightly run |
| Refresh | rebuilt/extended by the daily 03:00 job |
| Access | same read path the dashboard already uses for `store_pipeline.rpt_*` |
| Index | unique index on `snapshot_date` |

---

## 3. Column dictionary

| Column | Type | Meaning |
|---|---|---|
| `snapshot_date` | date | Business day of the row. Primary key. Sort/x-axis. |
| `items_count` | bigint | Total products tracked that day (currently ~1,992). |
| `out_of_stock_count` | bigint | Products with zero usable stock. |
| `stockout_risk_count` | bigint | Products about to run out (low days-of-cover). |
| `dead_stock_count` | bigint | Slow/no-movement products holding stock. |
| `overstock_count` | bigint | Products carrying excess stock. |
| `healthy_count` | bigint | Products in a healthy stock position. |
| `at_risk_count` | bigint | **out_of_stock + stockout_risk** — the "needs attention now" headline. |
| `total_inventory_units` | numeric | Total on-hand units across all products. |
| `avg_days_of_cover_30d` | numeric | Avg days of stock coverage at recent (30d) sales velocity. |
| `at_risk_7d_avg` | numeric | Rolling 7-day average of `at_risk_count` (smooths daily noise). |
| `at_risk_wow_delta` | bigint | Week-over-week change in `at_risk_count` (lag 7 days; **null** for the first 7 days). |
| `dbt_loaded_at` | timestamptz | Build timestamp (audit). |
| `dbt_source_relation` | text | Model name (audit). |

> The 5 status counts (`out_of_stock` + `stockout_risk` + `dead_stock` + `overstock`
> + `healthy`) sum to `items_count` for each day.

---

## 4. Current data (snapshot for layout/testing)

First and last 3 days of the series:

| snapshot_date | items_count | out_of_stock | stockout_risk | dead_stock | overstock | healthy | at_risk | avg_days_cover | at_risk_7d_avg | wow_delta |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-03-21 | 1992 | 998 | 8  | 509 | 247 | 230 | 1006 | 155.0 | 1006.0 | (null) |
| 2026-03-22 | 1992 | 998 | 10 | 488 | 257 | 239 | 1008 | 154.7 | 1007.0 | (null) |
| 2026-03-23 | 1992 | 998 | 11 | 480 | 253 | 250 | 1009 | 149.1 | 1007.7 | (null) |
| … | | | | | | | | | | |
| 2026-06-22 | 1992 | 998 | 25 | 507 | 252 | 210 | 1023 | 127.6 | 1023.4 | +1 |
| 2026-06-23 | 1992 | 998 | 23 | 514 | 249 | 208 | 1021 | 126.6 | 1023.0 | −3 |
| 2026-06-24 | 1992 | 998 | 22 | 509 | 254 | 209 | 1020 | 131.2 | 1022.6 | −3 |

**The story to show:** `stockout_risk_count` climbs over the window (≈8 → ~22–25) and
`avg_days_of_cover_30d` **falls** (155 → ~127–131) as sales erode coverage — that's
the real signal. `out_of_stock_count` and `total_inventory_units` are **flat by
design** (see §6) — don't build the headline around them.

---

## 5. Suggested presentation

- **"Inventory health over time"** line/area chart: x-axis `snapshot_date`, primary
  series `at_risk_count` (or the smoother `at_risk_7d_avg`). This is the headline.
- **Stacked-area composition:** the 5 status counts stacked to `items_count` shows
  the shifting mix (healthy vs at-risk vs dead/overstock) day by day.
- **Coverage trend:** a second line for `avg_days_of_cover_30d` (falling = tightening
  supply) — pairs naturally with the at-risk line on a dual axis.
- **WoW stat:** `at_risk_wow_delta` of the latest day as a "vs last week" delta chip
  (▲ red / ▼ green). It's null for the first week — guard for that.
- Pair with the single-day `rpt_inventory_risk` for drill-down: this trend = the
  headline; the risk report = "which items are at risk right now".

---

## 6. Gotchas

- **`out_of_stock_count` and `total_inventory_units` are flat** across the series.
  This is **expected, not a bug**: on-hand quantity comes from a single-row inventory
  source with no date dimension, so the absolute stock level doesn't vary by day. The
  meaningful, genuinely time-varying signals are **`stockout_risk_count`** and
  **`avg_days_of_cover_30d`** (driven by rolling sales velocity). Lead with those.
- **`at_risk_wow_delta` is null for the first 7 days** (no prior week to compare).
  Render null as "—", not 0.
- **Contiguous daily series** today (one row per calendar day). The WoW lag assumes
  contiguity; if a day is ever missing, the lag-7 compares to 7 rows back, not
  strictly the same weekday. Fine for now; just don't assume every gap is impossible.
- **Depth grows nightly.** Don't hard-code 96 rows — read the full series and let it
  lengthen. A "last 30 / 90 days" range selector is a good UX given it keeps growing.

---

## 7. Deploy status & cache revalidation

- The model is **built and tested** (not_null + unique on `snapshot_date`, ≥0
  accepted_range on all 7 count columns) and is **part of the `store_pipeline` prod
  schema** — it deploys with the nightly `dbt run --target prod` and is in the
  `store_analytics_dashboard` exposure (dbt lineage).
- After each daily prod build the pipeline calls the website **revalidate** webhook
  (tag `dashboard`, via `revalidate_website.py`). If the new chart uses the same
  `dashboard` cache tag, it refreshes automatically on the nightly run. If you put it
  behind a **new** cache tag, tell the pipeline owner so the revalidate call can
  include it.

---

## 8. Related (context, not required for the UI)

- `rpt_inventory_risk` / `rpt_inventory_actions` — latest-day, per-item risk and
  recommended actions (the drill-down behind this trend).
- `rpt_item_stockout_days` (new, same release) — per-**item** stockout exposure: how
  many days each product spent out-of-stock / at-risk, plus its longest unbroken
  at-risk streak. Complements this report (this = store-level over time; that =
  per-item over the whole window). Worth a companion "worst offenders" table.
- `fct_inventory_snapshot_history` (core) — the per-day, per-item time-series both
  reports are built on. Intermediate; not meant to be queried by the site directly.
