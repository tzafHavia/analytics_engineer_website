# Handoff → website agent: P1 definition fixes are LIVE (data side)

**Date:** 2026-07-02
**From:** data/pipeline agent
**Re:** the P1 "correctness & credibility" items in `new_git_readme/FIXES_FOR_AGENT.md`
(items **#2, #3, #4**). #1 (unit decimals) stays on your side — it's display-layer rounding.

## TL;DR
Three definition fixes are built and tested in **dev** and will land in **prod on the
next nightly** (published by DML via `05_publish_dashboard_models.py`). **No table was
added or removed** — same 20-object read-set, same grain. Two reports gained **new
columns**; `dim_product` changed **two placeholder strings**. Nothing you read today
breaks; the new columns are additive. Action needed from you is small — mostly *use*
the new columns and drop one old filter string.

---

## What changed (map to FIXES #2 / #3 / #4)

### FIXES #2 — "Avg days of cover: 50.8d vs 129.2d" → expose the **median**
The two numbers were both correct but both **means**, computed over different populations;
the mean is dragged up by a few massively-overstocked SKUs. I added a **median** beside
the mean in **both** reports so you can lead with the robust figure.

**New column (both tables):** `median_days_of_cover_30d`
- `rpt_inventory_health_trend.median_days_of_cover_30d` (grain: one row per `snapshot_date`)
- `rpt_executive_summary_daily.median_days_of_cover_30d` (grain: one row per `sale_date`)

The mean columns (`avg_days_of_cover_30d`) are **unchanged and still present** — I did not
remove them. On 2026-07-01 the gap was ~mean 151 vs **median 78** days, so the median is
a much fairer headline.

**Please do:** show **`median_days_of_cover_30d`** as the headline "days of cover" KPI on
both the Overview and Inventory views (so they finally agree). Keep the mean only if you
label it "average (skewed by overstock)". That single swap closes the #2 contradiction.

### FIXES #4 — "Unknown Item / Uncategorized junk rows" → tagged as intentional
`dim_product` no longer emits `'Unknown Item'` / `'Uncategorized'`. Unmapped/deleted POS
product ids now render as **`'(unmapped item)'`** and **`'(uncategorized)'`** (parenthesised
so they read as deliberate placeholders, not a bug).

Scope is tiny and verified: **0 true orphans** (every `fct_sales` item_id resolves in
`dim_product`), only **1** unmapped-name row + **8** uncategorized-category rows in the whole
dimension.

**Please do:**
- If the dashboard currently **filters or special-cases the string `'Unknown Item'`**
  (e.g. to hide it from the reorder list), update that filter to **`'(unmapped item)'`**
  — otherwise the row reappears. Same for any `'Uncategorized'` → `'(uncategorized)'`.
- Recommended per FIXES #4: keep them **grouped/tagged** rather than top of the reorder
  list. They're now clearly labelled, so a simple "sort real items first" is enough.

### FIXES #2 (second half) — dead-stock **507 vs 1,940** → split the two definitions
The two "dead stock" numbers were measuring different things: the **DEAD_STOCK stock
status** (needs on-hand stock) vs the **NO_RECENT_SALES velocity band** (zero recent sales,
regardless of stock). I exposed them **separately** so you can show whichever the label
promises.

**New column (both tables):** `no_recent_sales_count`, sitting next to the existing
`dead_stock_count`:
- `rpt_inventory_health_trend.no_recent_sales_count`
- `rpt_executive_summary_daily.no_recent_sales_count`

**Please do:** wherever a card says "dead stock", pick the column that matches the label —
`dead_stock_count` for "dead stock (on hand)", `no_recent_sales_count` for "no recent
sales" — and label the scope. (They currently coincide by the classifier's design, but
they are conceptually distinct and can diverge; showing both with clear labels removes the
#2 mismatch permanently.)

### FIXES #3 — workforce attributed-sales scale (₪1.3M vs ₪194K)
**No data change was needed — the math is already correct.** `attributed_sales` in
`rpt_workforce_productivity_summary` / `rpt_employee_productivity` sums store sales by
hours-share and reconciles to store totals **for the same window** (guarded by the dbt
test `assert_attributed_sales_match_daily`). The mismatch you saw is a **window
difference**, not a double-count: the workforce scorecard spans the **full history**, while
the Sales view you compared against was a **shorter/filtered period**.

**Please do (this is the real fix for #3):** make the two views honour the **same date
filter**. When the dashboard's global date range is applied, apply it to the workforce
cards too — then three employees' attributed sales will sum to the store net sales for that
same range. If a card is intentionally "all-time", label it so, and don't compare it
head-to-head with a filtered Sales figure. (Optional future add on my side:
`attributed_sales_30d` so you have a pre-windowed 30-day number — say the word if you want it.)

---

## Summary table

| FIXES | Fix | Table(s) | New/changed | Your action |
|---|---|---|---|---|
| #2 (cover) | median days of cover | `rpt_inventory_health_trend`, `rpt_executive_summary_daily` | **+col** `median_days_of_cover_30d` | headline the median |
| #2 (dead) | split status vs band | same two | **+col** `no_recent_sales_count` | label each to its column |
| #4 | tag orphans | `dim_product` | changed strings → `(unmapped item)`, `(uncategorized)` | update old `'Unknown Item'` filter |
| #3 | workforce window | — (already correct) | none | apply the **same date filter** to workforce cards |

## Verification (dev)
- `dbt build` on both reports + `dim_product`: **PASS, 0 warn, 0 error**. New columns each
  carry a `>= 0` range test (`>= 1` where applicable).
- Placeholder relabel confirmed live: 1×`(unmapped item)`, 8×`(uncategorized)`.

## Prod / timing
- Both reports are already in the 20-object allowlist, so they publish automatically. The
  two new columns arrive via `05`'s **schema-drift path** (recreate+reindex on first
  publish); the `dim_product` change is a plain truncate+append. **No allowlist change, no
  new table** — nothing for you to approve this time.
- After the next nightly, please confirm the new columns are present in `store_pipeline`
  and re-point the KPIs. Ping me if `05` hasn't picked up the new columns and I'll run the
  manual publish.

— data/pipeline agent
