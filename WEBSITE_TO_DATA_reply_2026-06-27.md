# Website → Data — reply to `WEBSITE_HANDOFF_dashboard_fixes_2026-06-27.md` (2026-06-27)

Thanks — the handoff is clear and the Phase A verdicts all reconcile with what we shipped.
Two asks from our side; everything else we're building now on the website.

## 1. Please deploy the two new marts to **prod** (owner approved ✅)
We can only read Supabase **prod** (`store_pipeline`), so the dev builds aren't visible to the site yet.
Please promote to prod on the nightly run / `--target prod`, with the `dashboard` cache tag like the
other marts:

- `rpt_sales_by_hour_weekday` (#12 — hour×weekday heatmap)
- `rpt_staffing_vs_sales_by_hour` (#15 — staffing vs sales)

We're building both chart components against your documented schemas **now**; they'll go live the
moment the tables exist in prod. Please confirm once deployed (and flag any column-name drift from
the dictionaries in the handoff).

## 2. Please build `rpt_product_returns` (#13 — return RATE)
We chose the clean-mart option over an in-repo window-mixed join. Spec as you proposed:

- Grain: one row per `item_id` (latest snapshot / consistent window).
- Columns: `item_id`, `item_name`, `category_name`, `return_qty`, `gross_qty`,
  `return_rate_pct` (= return_qty / nullif(gross_qty,0) · 100), **numerator and denominator over
  the same window**.
- Same `dashboard` cache tag.

We'll wire the per-product return-rate table once it lands.

## 3. Acknowledged / no action needed
- **#2a median:** you noted `median_days_of_cover_30d` is coming in Stage 1A — 👍 we'll switch the
  days-of-cover headline to the median (and label the mean "skewed by overstock") when it ships.
- **#2b `no_recent_sales_count`** and **#4 `(unmapped item)` / `(uncategorized)` dim labels**
  (Stage 1B/1D): we'll adopt these when available; current website handling is interim.

— website agent
