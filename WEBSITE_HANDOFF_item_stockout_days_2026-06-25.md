# Website Handover — Item Stockout Days Report

**Date:** 2026-06-25
**From:** data pipeline (dbt / store_pipeline)
**To:** portfolio website agent (Next.js dashboard on Vercel)
**Status:** built + tested on dev/prod; deployed to Supabase (see §7)

---

## 1. TL;DR — what's new

A new **per-item availability** report:

> **`store_pipeline.rpt_item_stockout_days`** — one row per product, counting how
> many days it sat **out-of-stock** or **at stockout-risk** over the tracked history,
> its **share of days** unavailable, and its **longest unbroken at-risk streak**.

This is the **per-item companion** to `rpt_inventory_health_trend`:
- `rpt_inventory_health_trend` = store-level, **over time** (a trend line).
- `rpt_item_stockout_days` = **per product, whole window** (a "worst offenders"
  ranking / table).

It answers: *"which specific products are chronically unavailable, and for how long
in a row?"* — perfect for a sortable **"worst offenders" table** or a "most at-risk
products" leaderboard.

---

## 2. Where it lives

| | |
|---|---|
| Database | Supabase Postgres (prod) |
| Schema | `store_pipeline` |
| Table | `rpt_item_stockout_days` |
| Grain | **one row per product** (`item_id`) |
| Current size | **1,992 rows** (every tracked product) |
| Coverage window | history of 96 business days (2026-03-21 → 2026-06-24), grows nightly |
| Refresh | rebuilt by the daily 03:00 job |
| Access | same read path the dashboard already uses for `store_pipeline.rpt_*` |
| Index | unique index on `item_id` |

> Default sort of the model is **`at_risk_days` descending** (worst availability
> first), but always apply your own `ORDER BY` in the query for the view you want.

---

## 3. Column dictionary

| Column | Type | Meaning |
|---|---|---|
| `item_id` | text | Product identifier. Primary key. **Note: text, not numeric** (codes like `'/'`, `'0000000121442'` exist). |
| `item_name` | text | Product name — **Hebrew** (RTL). See §6. |
| `product_category_id` | bigint | Category identifier (can be null for unclassified items). |
| `product_category_name` | text | Category name (Hebrew, RTL). |
| `total_snapshot_days` | bigint | Days the product appears in the history (the denominator). |
| `out_of_stock_days` | bigint | Days the product was OUT_OF_STOCK (empty). |
| `stockout_risk_days` | bigint | Days the product was STOCKOUT_RISK (about to run out). |
| `at_risk_days` | bigint | `out_of_stock_days + stockout_risk_days` — the headline metric. |
| `at_risk_pct` | numeric | `at_risk_days / total_snapshot_days × 100` (0–100, one decimal). |
| `longest_at_risk_streak` | bigint | Longest run of **consecutive** at-risk days (the real availability pain). |
| `first_at_risk_date` | date | First at-risk day (**null** if never at risk). |
| `last_at_risk_date` | date | Most recent at-risk day (**null** if never at risk). |
| `current_stock_status` | text | Status on the product's latest snapshot day (5 values, see §3a). |
| `dbt_loaded_at` | timestamptz | Build timestamp (audit). |
| `dbt_source_relation` | text | Model name (audit). |

### 3a. `current_stock_status` values
One of: `OUT_OF_STOCK`, `STOCKOUT_RISK`, `OVERSTOCK`, `DEAD_STOCK`, `HEALTHY`.

> `at_risk_days = out_of_stock_days + stockout_risk_days` always holds, and
> `longest_at_risk_streak ≤ at_risk_days ≤ total_snapshot_days` always holds.

---

## 4. Current data (snapshot for layout/testing)

(Hebrew `item_name` omitted from this table only to keep the console readable —
it IS populated in the data.)

| item_id | category_id | total_days | oos_days | risk_days | at_risk_days | at_risk_pct | longest_streak | current_status |
|---|---|---|---|---|---|---|---|---|
| `/` | (null) | 96 | 96 | 0 | 96 | 100.0 | 96 | OUT_OF_STOCK |
| `0000000121442` | 0 | 96 | 96 | 0 | 96 | 100.0 | 96 | OUT_OF_STOCK |
| `541952163` | 28 | 96 | 0 | 91 | 91 | 94.8 | **84** | STOCKOUT_RISK |
| `129` | 2 | 96 | 0 | 82 | 82 | 85.4 | 81 | STOCKOUT_RISK |
| `00000001` | 1 | 96 | 0 | 0 | 0 | 0.0 | 0 | OVERSTOCK |

**Distribution:** of 1,992 products, **1,044 had at least one at-risk day** and **948
were never at risk**. The worst sit at 96/96 days (chronically empty).

**The interesting nuance:** item `541952163` has **91** at-risk days but a longest
streak of only **84** — i.e. it recovered briefly then dropped again (intermittent),
which is a different operational story than a product empty for one solid block.
Showing both `at_risk_days` and `longest_at_risk_streak` distinguishes "chronic but
patchy" from "continuously out."

---

## 5. Suggested presentation

- **"Worst offenders" table:** sort by `at_risk_pct` (or `at_risk_days`) desc, show
  `item_name`, category, `at_risk_pct`, `longest_at_risk_streak`, `current_stock_status`.
  A sortable/filterable table is the natural primary view.
- **Status chip:** color `current_stock_status` (red OUT_OF_STOCK, amber STOCKOUT_RISK,
  grey DEAD_STOCK, blue OVERSTOCK, green HEALTHY).
- **Availability bar:** a small horizontal bar of `at_risk_pct` per row reads instantly.
- **Streak emphasis:** surface `longest_at_risk_streak` as "longest gap: N days" — it's
  the most actionable single number (how long customers couldn't buy it).
- **Filters:** by category and by `current_stock_status`. A "currently at risk" toggle
  (`current_stock_status in ('OUT_OF_STOCK','STOCKOUT_RISK')`) is a useful default.
- **Pair with `rpt_inventory_health_trend`:** trend chart = the store-level headline;
  this table = the click-through "which items drove it."

---

## 6. Gotchas

- **`item_id` is TEXT, not a number.** Real values include `'/'` and zero-padded codes
  like `'0000000121442'`. Don't parse it as an integer or strip leading zeros.
- **RTL names:** `item_name` and `product_category_name` are Hebrew. Render with
  `dir="rtl"` (or `dir="auto"`) so they lay out correctly next to LTR numbers.
- **Nullable fields:** `first_at_risk_date` / `last_at_risk_date` are **null** for the
  948 never-at-risk products; `product_category_id` can be null for unclassified items.
  Render nulls as "—", and don't assume every product has an at-risk date.
- **`at_risk_days` vs `longest_at_risk_streak`:** they are different metrics (total vs
  longest consecutive run). Don't treat them as interchangeable — see §4.
- **Window grows nightly.** `total_snapshot_days` increases over time (currently 96).
  Don't hard-code it; use `at_risk_pct` for a stable cross-product comparison.
- **Stock-level caveat (shared with the inventory domain):** OUT_OF_STOCK is the
  dominant status because on-hand quantity comes from a single-row inventory source;
  the genuinely dynamic signal is STOCKOUT_RISK (sales-velocity driven). The report is
  still correct — just know OUT_OF_STOCK skews high by data design.

---

## 7. Deploy status & cache revalidation

- **Deployed to Supabase prod** (2026-06-25): `store_pipeline.rpt_item_stockout_days`,
  1,992 rows, all 10 dbt tests green on prod (not_null + unique + relationships to
  `dim_product` on `item_id`, ≥0 ranges on the day-count columns, accepted_values on
  `current_stock_status`).
- It rebuilds with the nightly `dbt run --target prod` and is in the
  `store_analytics_dashboard` exposure (dbt lineage).
- After each daily prod build the pipeline calls the website **revalidate** webhook
  (tag `dashboard`). If this view uses the same `dashboard` cache tag, it refreshes
  automatically on the nightly run. If you put it behind a **new** cache tag, tell the
  pipeline owner so the revalidate call can include it.

---

## 8. Related (context)

- `rpt_inventory_health_trend` (same release) — store-level inventory health **over
  time**; this report is its per-item drill-down. See
  `WEBSITE_HANDOFF_inventory_health_trend_2026-06-25.md`.
- `rpt_inventory_risk` / `rpt_inventory_actions` — latest-day, per-item risk and the
  recommended action for each product (what to do *right now* about an at-risk item).
- `fct_inventory_snapshot_history` (core) — the per-day, per-item time-series this
  report aggregates. Intermediate; not meant to be queried by the site directly.
