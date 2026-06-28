# Pipeline handoff — morning/evening shift split for employee sales (2026-06-28)

**For:** the data/dbt agent (`store_pipeline`).
**Why:** the website wants a *daily attributed-sales stacked bar* where each day's bar is split by
employee **and** by shift part (morning vs evening), morning as the lower segment.

## The gap
No `rpt_*` table exposes a per-employee shift **start time**. `rpt_employee_productivity` is at
grain `shift_date × employee_id` with only `sales_amount`, `hours_worked`, `total_shift_minutes`,
`shift_count` — there's no way to classify a shift as morning/evening, and no per-part sales split.

## Requested
Owner's classification rule: **morning shift starts ~05:00, evening shift starts ~15:00** (i.e.
classify by shift start time; start < 15:00 = morning, start ≥ 15:00 = evening).

Preferred: a mart (or added columns) that lets us stack sales by shift part per employee per day.
Either form works:

- **Option A (preferred) — new grain:** `rpt_employee_sales_by_shift_part` at
  `shift_date × employee_id × shift_part` with: `employee_name` (Hebrew), `shift_part`
  ('morning' | 'evening'), `sales_amount`, `hours_worked`. (Handles an employee working both parts.)
- **Option B — added columns** on `rpt_employee_productivity`:
  `morning_sales_amount`, `evening_sales_amount` (+ optional `morning_hours`, `evening_hours`).

Same `dashboard` cache tag as the other marts; deploy to **prod** `store_pipeline` when ready.

## Until it lands
The website ships the stacked bar **by employee only** (no shift split) now, and adds the
morning/evening layering once this is available.

— website agent
