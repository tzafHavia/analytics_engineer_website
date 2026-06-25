# Website Handover — Workforce Productivity Report

**Date:** 2026-06-25
**From:** data pipeline (dbt / store_pipeline)
**To:** portfolio website agent (Next.js dashboard on Vercel)
**Status:** model built + tested; deploy to Supabase prod in progress (see §7)

---

## 1. TL;DR — what's new

A new **workforce** domain landed in the pipeline: 3 store employees with realistic
shifts and **payroll (overtime tiers)**. It surfaces **one new dashboard table** you
should add to the site:

> **`store_pipeline.rpt_workforce_productivity_summary`** — a per-employee scorecard
> (one row per employee): hours, overtime breakdown, total pay, attributed sales,
> labor efficiency, recent-form averages, and three ranks.

There is also an existing daily report, **`rpt_employee_productivity`** (already on the
dashboard), that is the per-day detail behind this summary. The new table is the
**aggregated, ranked roll-up** — ideal for a "team scorecard" card/section.

---

## 2. Where it lives

| | |
|---|---|
| Database | Supabase Postgres (prod) |
| Schema | `store_pipeline` |
| Table | `rpt_workforce_productivity_summary` |
| Grain | **one row per employee** (currently **3 rows**) |
| Refresh | rebuilt by the daily 03:00 job (`dbt run --target prod`) |
| Access | same read path / connection the dashboard already uses for `store_pipeline.rpt_*` |

---

## 3. Column dictionary

| Column | Type | Meaning |
|---|---|---|
| `employee_id` | bigint | Employee identifier (101 / 102 / 103). Primary key of the row. |
| `employee_name` | text | Display name — **Hebrew** (RTL). See §6. |
| `total_shifts` | bigint | Total shifts worked over the full window. |
| `total_hours` | numeric | Total hours worked. |
| `regular_hours` | numeric | Hours paid at ×1.0 (first 8h of each shift). |
| `ot125_hours` | numeric | Overtime hours paid at ×1.25 (hours 9–10). |
| `ot150_hours` | numeric | Overtime hours paid at ×1.5 (hours 11–12). |
| `hourly_rate` | numeric | Base hourly wage (ILS). Currently ₪35.00 for all. |
| `total_pay` | numeric | Total payroll cost (ILS) = regular + ot125 + ot150 pay. |
| `avg_hourly_cost` | numeric | `total_pay / total_hours` — blended cost per worked hour (≥ base rate; rises with overtime). |
| `attributed_sales` | numeric | Store sales attributed to the employee by their share of worked hours. |
| `sales_per_labor_shekel` | numeric | `attributed_sales / total_pay` — sales generated per ₪1 of labor cost (efficiency KPI). |
| `avg_daily_sales_7d` | numeric | Avg daily attributed sales over the trailing 7 days ("recent form"). |
| `avg_daily_hours_7d` | numeric | Avg daily hours worked over the trailing 7 days. |
| `sales_rank` | bigint | Rank by `attributed_sales` (1 = highest). |
| `hours_rank` | bigint | Rank by `total_hours` (1 = highest). |
| `efficiency_rank` | bigint | Rank by `sales_per_labor_shekel` (1 = highest). |
| `dbt_loaded_at` | timestamptz | Build timestamp (audit). |
| `dbt_source_relation` | text | Model name (audit). |

> All money values are **ILS (₪)**. Hours are decimal hours (e.g. `9.51` = 9h 30m).

---

## 4. Current data (snapshot for layout/testing)

| employee_id | employee_name | total_shifts | total_hours | total_pay | attributed_sales | sales_per_labor_shekel | sales_rank | hours_rank | efficiency_rank |
|---|---|---|---|---|---|---|---|---|---|
| 101 | רונן משולם | 126 | 1198.19 | 43,681.92 | 434,779.72 | 9.95 | 1 | 2 | 2 |
| 102 | ארטיום מנוביץ | 125 | 1203.05 | 44,000.42 | 428,935.15 | 9.75 | 2 | 1 | 3 |
| 103 | משה סבג | 119 | 1135.75 | 41,434.44 | 416,618.83 | 10.05 | 3 | 3 | 1 |

Notice the ranks **diverge** across dimensions (101 leads sales, 102 leads hours,
103 leads efficiency) — that's the interesting story to show, not a single ranking.

---

## 5. Suggested presentation

- **"Team scorecard"** section: a 3-card or 3-row layout, one per employee, each
  showing total pay, total hours (with a small regular/OT split bar), attributed
  sales, and the efficiency KPI (`sales_per_labor_shekel`).
- **Rank badges:** show the three ranks as small chips ("#1 sales", "#1 efficiency").
  Because they diverge, every employee gets to be "#1" at something — good UX.
- **Overtime breakdown:** a stacked bar of `regular_hours / ot125_hours / ot150_hours`
  per employee communicates the labor-cost mix at a glance.
- **Recent form:** `avg_daily_sales_7d` as a "last 7 days" mini-stat.
- Pair with the existing daily `rpt_employee_productivity` for a drill-down trend
  (this summary = the headline; the daily report = the detail line chart).

---

## 6. Gotchas

- **RTL names:** `employee_name` is Hebrew. Render with `dir="rtl"` (or `dir="auto"`)
  on that field so it lays out correctly next to LTR numbers. Don't reverse it manually.
- **Money formatting:** format as ILS with the ₪ symbol; `total_pay` / `attributed_sales`
  are large (tens / hundreds of thousands).
- **Small N:** exactly 3 employees today. Don't hard-code 3 — read all rows — but a
  3-up layout is a safe design assumption for now.
- **`avg_hourly_cost` > `hourly_rate`** is expected and meaningful (overtime drives it
  above ₪35); it's a feature, not a rounding bug.

---

## 7. Deploy status & cache revalidation

- The model is **built and tested on dev** (PASS, 0 errors). Prod deploy steps:
  `dbt seed --target prod` (loads `employee_wages`) → `dbt run --target prod` →
  `dbt test --target prod`. Confirm `store_pipeline.rpt_workforce_productivity_summary`
  is queryable before wiring the UI.
- After each daily prod build the pipeline calls the website **revalidate** webhook
  (tag `dashboard`, via `revalidate_website.py` using `REVALIDATE_SECRET` /
  `WEBSITE_BASE_URL` from `.env`). If the new section uses the same `dashboard`
  cache tag, it will refresh automatically on the nightly run. If you put it behind a
  **new** cache tag, tell the pipeline owner so the revalidate call can include it.
- Exposure: the model is registered under the `store_analytics_dashboard` exposure in
  dbt (`models/marts/reporting/exposures.yml`), so it's formally part of the dashboard's
  lineage.

---

## 8. Related (context, not required for the UI)

- `fct_employee_shift` (core) now also carries per-shift pay columns
  (`regular_pay`, `ot125_pay`, `ot150_pay`, `total_pay`, tier hours, `hourly_rate`) if
  you ever want a per-shift detail view.
- `int_workforce__shift_pay` is the per-shift payroll model; `employee_wages` (seed) is
  the rate source. These are intermediate/seed and not meant to be queried by the site.
