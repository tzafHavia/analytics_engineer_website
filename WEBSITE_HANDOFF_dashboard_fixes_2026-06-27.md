# Website agent — dashboard fixes verification sheet (2026-06-27)

This is the **single screen for the website/dashboard agent**. It consolidates the
punch-list in `new_git_readme/FIXES_FOR_AGENT.md` into a checklist the agent works
through and the reviewer checks off. Every item says **who owns it** (🟦 website /
🟩 data-side, already provided or coming) and, where a metric was "contradictory",
the **one authoritative definition** to use.

Owner legend: 🟦 = website/dashboard repo · 🟩 = dbt data layer (this repo)
Severity: 🔴 correctness · 🟠 clarity/UX · 🟢 polish

> The data layer reads only the `rpt_*` tables. The agent must read `rpt_*` only —
> never `raw` or intermediate marts.

---

## ✅ Response to your `PIPELINE_HANDOFF_REQUEST_2026-06-27.md`
Both requested models are **built and tested on dev under the exact names you asked for** —
no renaming needed on your side. Full data dictionaries are inline at items **#12** and **#15** below.

| You requested | Status | Notes |
|---|---|---|
| `rpt_sales_by_hour_weekday` | ✅ **built (dev), tests green** | `day_of_week` = 0=Sun…6=Sat; `day_name` = **English**; window = full history; see #12. |
| `rpt_staffing_vs_sales_by_hour` | ✅ **built (dev), tests green** | hour-only grain (24 rows); labour allocated from minute-precision shift times; see #15. |
| return-rate column (#13, lower prio) | ↩︎ **answered** | `rpt_returns_analysis_daily` has **no gross sales** — join to `rpt_product_velocity`, or ask me for a clean `rpt_product_returns`. See #13. |

**Prod (Supabase `store_pipeline`) deploy is pending the owner's approval** — both models will land
on the nightly run / a manual `--target prod` once confirmed, with the `dashboard` cache tag like
the other marts. They're already in the `store_analytics_dashboard` exposure.

---

## 🔴 P1 — Correctness & credibility

### [ ] 1. Unit counts show decimals — 🟦 website
- **Symptom:** "7,387.592 units", "330.36" in KPIs and the daily table.
- **Authoritative answer (🟩 data):** these are **correct**, not a bug.
  `total_units_sold = sum(quantity)` and some items are **weighed goods** (deli,
  produce sold by kg), so quantity is genuinely fractional.
- **Fix (website):** round unit *counts* to integers in the display layer
  (`Math.round` / `toLocaleString` with 0 decimals). Do **not** round currency.
  Optional: if a measure is genuinely weight, give it its own column labelled in kg.

### [ ] 2a. "Avg days of cover" differs across views (50.8d vs 129.2d) — 🟦 website
- **Authoritative answer (🟩 data):** both numbers come from the **same column**,
  `avg_days_of_cover_30d`, exposed identically in `rpt_executive_summary_daily`
  **and** `rpt_inventory_health_trend`. The gap is a **mean-vs-skew** artefact: a
  handful of overstock items with days-of-cover in the thousands pull the *mean*
  to ~129; the ~50 figure is the *robust* (median-like) center.
- **Rule:** both views must read the **same field**, for the **same snapshot**
  (the **latest** `snapshot_date`). Do not mean in one view and median in another.
- **Coming (🟩 data, Stage 1A):** `rpt_inventory_health_trend` + `rpt_executive_summary_daily`
  will additionally expose **`median_days_of_cover_30d`**. Display the **median**
  as the headline (robust to overstock outliers) and keep mean only if labelled
  "mean (skewed by overstock)". Until then, pick one (latest snapshot) and use it everywhere.

### [ ] 2b. "Dead stock" differs (507/508 vs 1,940) — 🟦 website + 🟩 data label
- **Authoritative answer (🟩 data):** these are **two different metrics**, both legitimate:
  - **`DEAD_STOCK` = 508** — items that **have stock on hand** but had **0 sales in 30 days**
    (`current_inventory_qty > 0 AND sold_qty_30d = 0`). This is the inventory/Overview number.
  - **~1,940 = `NO_RECENT_SALES` velocity band** — **any** item (stock or not) with
    0 sales in 30 days. This is a *velocity* concept, used in Products.
- **Fix:** stop labelling both "dead stock". Use **"Dead stock (508)"** for the
  inventory metric and **"No recent sales (1,940)"** for the velocity metric.
- **Coming (🟩 data, Stage 1B):** a clearly-named `no_recent_sales_count` field so
  the two are never conflated again.

### [ ] 3. Workforce attributed sales don't reconcile with Sales view — 🟦 website
- **Symptom:** Workforce cards show ₪435K–439K **per employee**; Sales view shows
  ~₪194K store net sales for the period. 3 × ₪435K ≈ ₪1.3M ≠ ₪194K.
- **Authoritative answer (🟩 data):** the attribution math is **correct and tested**
  (singular test `assert_attributed_sales_match_daily` asserts the daily sum of
  attributed sales equals daily store sales within ₪0.01). The mismatch is a
  **time-window mismatch**: the Workforce cards aggregate **all-time** attributed
  sales from `rpt_employee_productivity` (grain `shift_date × employee_id`), while
  the Sales view shows the **selected 30-day** window.
- **Fix (website):** make the Workforce cards respect the **same global date filter**
  as every other view (sum `sales_amount` over the selected window only). If you
  intentionally keep all-time, label the cards **"all-time"** explicitly. After the
  fix, Σ(employee attributed sales over window) must ≈ store net sales over the same window.

### [ ] 4. Junk / placeholder rows ("Unknown Item", "Uncategorized") — 🟩 data + 🟦 website
- **Authoritative answer (🟩 data):** these are **orphan `item_id`s** — POS product
  deletions that leave sales/inventory rows whose item_id no longer maps to `items`.
  This is documented known source noise (`severity: warn` relationships tests).
- **Coming (🟩 data, Stage 1D):** unmapped items will get a consistent label
  (e.g. `item_name = '(unmapped item)'`, `category = '(uncategorized)'`) at the dim
  level, so every consumer is clean.
- **Fix (website):** until then, group nulls under one explicit "Uncategorized"
  bucket or filter them out of *action* tables (reorder list) — never show a raw blank.

---

## 🟠 P2 — Clarity & UX — 🟦 website (all)

### [ ] 5. Too much per view → establish hierarchy
Lead Inventory and Products with their 1–2 most important elements; collapse or
move secondary charts below the fold.

### [ ] 6. Every chart needs a one-line "so what" caption
Add a plain-language takeaway per chart. Suggested captions (data-informed):
- Sales-by-hour: "Busiest 11:00–15:00 — staff accordingly."
- Sales-vs-GP scatter: "A few high-volume products earn thin margin — review pricing."
- Category GP bar: "Tobacco leads revenue, but [category X] drives margin."

### [ ] 7. Category treemap dominated by one slice → replace with sorted GP bar
- Treemap is ~66% tobacco and unreadable.
- **Data is ready (🟩):** `rpt_category_performance_30d` already exposes
  **`gross_profit`** per category. Render a **sorted horizontal bar of gross profit**
  (not revenue) — legible, and tells the better "margin leaders ≠ revenue leaders" story.

### [ ] 8. Cap long tables → top 10–15 + "show all" / CSV export
Reorder list (1019+), category table (28), product scatter (100). Privilege the
most urgent / highest-value rows; expander or export for the rest.

### [ ] 9. Inventory view should LEAD with the action plan
Move "Reorder now" + the action table (`rpt_inventory_actions`) to the **top** of
the Inventory view, above the analytical charts. Lead with the action, support with analysis.

---

## 🟢 P3 — Polish & differentiators — 🟦 website (data dependencies noted)

### [ ] 10. Direction arrows on ALL KPIs (not just Total Sales) — 🟦 (🟩 optional)
Every KPI card gets the up/down arrow + % vs prior period. Prior-period values are
derivable from the existing daily series; if you'd prefer a ready-made field, a
`rpt_kpi_summary` (current vs prior-period per KPI) is on the data backlog (Stage 2D, optional).

### [ ] 11. Sparklines inside KPI cards — 🟦 website
A 30-day trend line inside each KPI card. Use the existing daily series
(`rpt_sales_trend_daily` / `rpt_executive_summary_daily`). No new data needed.

### [ ] 12. Sales-by-hour → hour × weekday heatmap — 🟦 website · 🟩 **DATA DELIVERED (dev)**
The current bar averages across all days. A heatmap ("Friday 14:00") is far more
actionable for staffing.
**✅ Model built & tested on dev:** **`rpt_sales_by_hour_weekday`** (168 rows, grain
`day_of_week × sales_hour`). Tests green (PASS, 0 errors). *Prod deploy pending owner approval.*

| Column | Type | Meaning |
|---|---|---|
| `day_of_week` | integer | **0=Sunday … 6=Saturday** (Postgres DOW). |
| `day_name` | text | English day name ("Sunday"). UI renders RTL where needed. |
| `sales_hour` | integer | hour of day, 0–23. |
| `net_sales_amount` | numeric | NET sales (returns subtracted), summed over the window. |
| `tickets_count` | bigint | distinct receipts in that weekday-hour. |
| `occurrences` | bigint | # of that weekday with activity in the window (26–27 currently). |

- **Window:** full available history (same scope as `rpt_sales_by_hour`).
- **Heatmap cell value:** use `net_sales_amount / occurrences` for a per-occurrence
  ("typical Friday 14:00") average, or raw `net_sales_amount` for totals.
- Grain confirmed ≤168 rows; current peaks are Wed/Sun midday.

### [ ] 13. Return RATE, not just absolute returns — 🟦 website (try in-repo first)
**Answer to your question:** `rpt_returns_analysis_daily` is **returns-only** — it carries
`return_qty` / `return_amount` per `(receipt_date, item_id)` but **no gross sales**, so the
ratio is not computable from it alone. Two options:
- **In-repo (your preferred path):** join your aggregated returns to **`rpt_product_velocity`**
  (`sold_qty_30d` / `sold_qty_7d` per `item_id`) or `rpt_product_performance_30d`. ⚠️ Mind the
  window: returns there are all-time, `sold_qty_30d` is 30-day — only mix windows knowingly.
- **If you'd rather have it clean (🟩):** I'll build **`rpt_product_returns`** with numerator
  and denominator over the **same** window (`return_qty`, `gross_qty`, `return_rate_pct` per item).
  Say the word and it ships like the others. (Stage 2B, on request.)

### [ ] 14. Quadrant labels on the scatters — 🟦 website
Label the inventory-vs-sales and sales-vs-GP scatters directly ("overstocked",
"reorder", "high sales / low margin") so they read without the caption.

### [ ] 15. Cross-link Workforce ↔ Sales ("are we staffed when it's busy?") — 🟦 website · 🟩 **DATA DELIVERED (dev)**
Plot sales-per-labour-hour against the hourly traffic pattern.
**✅ Model built & tested on dev:** **`rpt_staffing_vs_sales_by_hour`** (24 rows, one per hour).
Feasibility confirmed — shift start/end carry minute precision, so labour is allocated to hour
buckets by interval overlap. Tests green. *Prod deploy pending owner approval.*

| Column | Type | Meaning |
|---|---|---|
| `sales_hour` | integer | hour of day, 0–23 (full 24-row spine). |
| `labour_hours` | numeric | total employee-hours present during that hour over the window. |
| `headcount_avg` | numeric | avg simultaneous staff during that hour (`labour_hours / staffed days`). |
| `net_sales_amount` | numeric | net sales in that hour over the window. |
| `tickets_count` | bigint | receipts in that hour over the window. |

- **sales-per-labour-hour** (compute UI-side) = `net_sales_amount / nullif(labour_hours, 0)`.
- Labour **and** sales are both restricted to the date range present in **both** facts, so the
  ratio is window-consistent.
- **Gotcha (this is the insight, not a bug):** overnight hours (≈00:00–04:00) show **sales with
  near-zero `labour_hours`** — the store rings sales when little/no staff is punched in. Surface
  it as "unstaffed trading" rather than hiding it. Open hours (05:00–23:00) sit at `headcount_avg ≈ 1`.
- `day_of_week` was **not** included (kept to a clean 24-row grain); say the word and I'll add the
  weekday split (same allocation technique joined to `dim_date`).

### [ ] 16. KEEP the attribution caveat — 🟦 website
The "estimated by hour-share, not transaction ownership" note shows analytical
maturity. **Do not remove it.**

---

## Notes for the reviewer
- Items 1, 2a, 2b, 3 are the credibility-critical ones — verify these first.
- Data-side deliverables (Stage 1 fixes + Stage 2 new reports) are tracked in
  `WORK_PLAN_2026-06-27.md`. When a new `rpt_*` ships, it gets its own column
  dictionary appended here (same format as the other `WEBSITE_HANDOFF_*` docs).
- Repo/README housekeeping (FIXES items 17–20) is **data-repo side**, handled in
  Stage 0 of the work plan — not the website agent's job.
