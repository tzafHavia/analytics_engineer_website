# Dashboard Fixes Plan — 2026-06-27

**Source:** `FIXES_FOR_AGENT.md` (external design/dev critique).
**Method:** every claim **verified against the actual code/data** before accepting it (the user
asked me not to trust the critique blindly). Verdicts below.
**Backup:** `backups/dashboard_2026-06-27/` (+ `RESTORE.md`) — revert point for all this work.
**Companion:** `DASHBOARD_REDESIGN_PLAN_2026-06-27.md` (per-tab purpose/audience/redesign).

---

## Verification verdicts

| # | Critique claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Unit counts show decimals | **PARTLY TRUE** | Overview "units" KPI **already rounds** (`formatNumber`, `maximumFractionDigits:0`, page.js:28). But **Sales tab** units KPI (`SalesTabContent.jsx:68`) and the **Overview daily table** (`OverviewDailyPerformanceTable.jsx:25`) do **not** → decimals show. Fix those two. |
| 2 | Metrics contradict across views | **TRUE — serious** | *Days of cover:* Overview reads precomputed `avg_days_of_cover_30d` from `rpt_executive_summary_daily` (dashboardData.js:342); Inventory computes a weighted avg excluding nulls from `rpt_inventory_risk` (:633) → different numbers, both displayed. *Dead stock:* Overview=`stock_status='DEAD_STOCK'` (~507); Inventory KPI=`velocity_band='NO_RECENT_SALES'`; Products=`velocity_band IN ('NO_RECENT_SALES','SLOW','OUT_OF_STOCK')` (~1,940, **mislabeled** "dead stock"). Three definitions. |
| 3 | Workforce sales don't reconcile with Sales view | **TRUE — needs investigation** | Unscoped Workforce uses the **all-time** `rpt_workforce_productivity_summary`; Sales view is a **30-day** window → ₪435K/employee vs ₪194K store. Worse: 3×~₪435K ≈ ₪1.3M but all-time store net ≈ ₪736K → the hour-share attribution may **not partition** (possible double-count). Backend must confirm the math + window. |
| 4 | Junk/placeholder rows in reorder list | **TRUE** | Reorder/dead-stock queries join `dim_product`; source has placeholder products (e.g. `item_id='/'`, zero-padded codes) that sort to the top. No exclusion in the query. |
| 5 | Too much per view, no hierarchy | **TRUE (UX judgment)** | Inventory + Products are long, flat stacks of equal-weight panels. |
| 6 | Charts lack a "so what" caption | **TRUE — high value** | No chart carries a takeaway line today. |
| 7 | Treemap dominated by one slice (tobacco ~66%) | **TRUE** | `CategoryTreemap.jsx` area = sales share → one giant tile. Fix = sorted horizontal **GP** bar. |
| 8 | Long tables need capping | **TRUE** | Reorder ~1019, scatter 100, category 28 rendered in full. |
| 9 | Inventory should lead with the action plan | **TRUE (easy win)** | Action table currently sits **below** charts in `InventoryTabContent.jsx`. |
| 10 | Direction indicators on ALL KPIs | **VALID** | Only Total Sales has a WoW delta chip today. Others need prev-period deltas (some already computed, some need new queries). |
| 11 | Sparklines in KPI cards | **VALID (nice-to-have)** | Needs a small per-KPI series; medium effort. |
| 12 | Hour × weekday heatmap | **VALID but BLOCKED** | `rpt_sales_by_hour` is hour-only (averaged across days). Needs a new **hour×weekday** mart → **data-pipeline dependency** (see §External). |
| 13 | Return RATE, not absolute | **VALID** | Likely buildable from `rpt_returns_analysis_daily` ÷ product sales; backend to confirm columns. |
| 14 | Quadrant labels on scatters | **VALID (easy, frontend-only)** | Pure Recharts annotation. |
| 15 | Cross-link Workforce ↔ Sales (staffed when busy?) | **VALID but likely BLOCKED** | Needs labour hours by hour-of-day vs sales by hour. Check `fct_employee_shift` granularity → probable **data-pipeline dependency**. |
| 16 | Keep the attribution caveat | **ALREADY DONE** | Disclaimer present in `WorkforceTabContent.jsx`. No work. |
| 17 | Clean repo root (compilation_output.txt, .backup/, …) | **NOT THIS REPO** | None of those files exist here → targets the **data-pipeline repo**. Out of scope. (This repo's own clutter is handled in WORK_PLAN R5.) |
| 18 | Reproducibility note (SQL Server + Task Scheduler) | **NOT THIS REPO** | Pipeline-repo README concern. Out of scope. |
| 19 | Fix inferred `rpt_` names in lineage SVG | **NOT THIS REPO** | No lineage SVG here; dbt-docs uses `manifest.json`. Pipeline repo. |
| 20 | Verify README facts (39 models, 179 tests) | **PARTLY THIS REPO** | Those counts are pipeline facts, but verify any version cited in **this** repo's README / project page. Small task. |

**Net:** the critique is **mostly correct and well-judged**. Main corrections: #1 is partial
(Overview KPI already fixed); #16 already done; **#17–19 belong to the data-pipeline repo, not
here**; #12 & #15 (and maybe #13) need new pipeline data.

---

## Agent assignment & phases

> ⚠️ **Agent-team gap (your call):** items **12, 15** (and possibly 13) require **new marts**
> from the **store_pipeline / data-pipeline project** — that's a *separate* repo with its own
> agent, NOT one of this site's four agents (ui-designer, animator, backend-engineer,
> dashboard-engineer). Options: (a) send a handoff request to the pipeline project, (b) defer
> them, (c) best-effort from existing data where possible. See "Decisions" at the bottom.
> **animator** is essentially idle for this batch (only optional sparkline/caption motion).

### Phase A — P1 correctness (do first; protects credibility)
| Item | Task | Owner |
|---|---|---|
| 1 | Round units to integers in Sales KPI + Overview daily table (display layer) | dashboard-engineer |
| 2 | **Unify metric definitions.** Pick ONE source per metric (days-of-cover, dead-stock); align Overview/Inventory/Products or label each with explicit scope. Rename Products "dead stock"→"slow & dead movers". | backend-engineer (defs) + dashboard-engineer (labels) |
| 3 | Investigate workforce attribution vs store sales; fix window mismatch and/or attribution partition; label the period on the tab. | backend-engineer |
| 4 | Exclude/bucket junk products (null/placeholder `item_name`, sentinel `item_id`) in reorder & dead-stock queries. | backend-engineer |

### Phase B — P2 clarity (biggest UX gain for least effort)
| Item | Task | Owner |
|---|---|---|
| 9 | Reorder Inventory tab: action table on top, analysis below | dashboard-engineer |
| 6 | Add one plain-language "so what" caption per chart | dashboard-engineer (copy) + ui-designer (caption style) |
| 7 | Replace category treemap with sorted horizontal **GP** bar | dashboard-engineer (+ backend if GP not exposed) |
| 8 | Cap long tables to top 10–15 + "show all" expander | dashboard-engineer |
| 5 | Establish visual hierarchy per view (lead element + below-the-fold) | ui-designer + dashboard-engineer |

### Phase C — P3 differentiators (as time allows)
| Item | Task | Owner |
|---|---|---|
| 14 | Quadrant labels on scatters | dashboard-engineer |
| 10 | WoW direction chips on all KPI cards | backend-engineer (deltas) + dashboard-engineer (chips) |
| 11 | Sparklines in KPI cards | dashboard-engineer (+ animator optional) |
| 13 | Return-rate metric | backend-engineer + dashboard-engineer |
| 12 | Hour×weekday heatmap | **pipeline (data)** → dashboard-engineer |
| 15 | Workforce↔Sales "staffed when busy" | **pipeline (data)** → dashboard-engineer |

### Phase D — housekeeping
| Item | Task | Owner |
|---|---|---|
| 20 | Verify README/project-page facts in THIS repo | orchestrator |
| 17–19 | Forward to the data-pipeline project (out of scope here) | (handoff) |

---

## Recommended order
Phase A (1→4) → Phase B (9,6,7,8,5) → Phase C (14,10 first, then 11,13; 12/15 pending data)
→ Phase D. Each phase: implement → `npm run build` → orchestrator review → checkpoint commit.

## Decisions — RESOLVED 2026-06-27
- **D-A → REQUEST HANDOFF.** Items 12 & 15 need new pipeline marts → I write a data-spec
  handoff (`PIPELINE_HANDOFF_REQUEST_2026-06-27.md`) for the data-pipeline project; UI built
  once it lands. (#13 return-rate: try in-repo first; only request if columns insufficient.)
- **D-B → UNIFY TO ONE DEFINITION.** Canonical choices (backend-engineer to confirm & apply):
  - **Dead stock = `stock_status='DEAD_STOCK'`** from latest `rpt_inventory_risk` everywhere
    it's *labelled* "dead stock". The Products broad count (`SLOW`+`NO_RECENT_SALES`+
    `OUT_OF_STOCK`) is a **different metric** → rename it **"Slow & dead movers"** (not unified).
  - **Avg days of cover = the pipeline mart value** `avg_days_of_cover_30d` (single source of
    truth) on **both** Overview and Inventory; drop the ad-hoc weighted-avg-excluding-nulls
    recompute. Backend confirms the two agree before shipping.
- **D-C → P1 CORRECTNESS ONLY** this round (items 1–4), then pause for review. P2/P3 next round.

## This round = Phase A only (items 1–4) — ✅ DONE 2026-06-27
- **#1** units rounded to integers (SalesTabContent units KPI + OverviewDailyPerformanceTable
  'number' formatter). Overview total-units KPI already rounded.
- **#2** unified: Inventory dead-stock now `stock_status='DEAD_STOCK'` (= Overview, both **508**);
  avg-days-of-cover now the single mart value on both (both **132.58**, was 183.09 in Inventory);
  Products KPI key `deadStockCount`→`slowAndDeadCount`, relabelled **"Slow & dead movers"**.
- **#3** root cause = **window/labeling, NOT a data bug.** Backend proved the hour-share
  attribution partitions exactly: Σ employee attributed = store net (₪1,303,508.20 all-time;
  ₪236,009.34 / 30d). The critique's "₪736K" was a **stale** figure. Fix = explicit period
  label "All time · 22 Dec 2025 – 26 Jun 2026" on the Workforce tab. **No pipeline handoff needed.**
- **#4** one junk product (`item_id='/'`, "Unknown Item") filtered from reorder/dead-stock/
  scatter; zero-padded phone-topup codes confirmed REAL and kept.
- `npm run build` clean. Backend agent did items 2–4; dashboard-engineer hit a session limit so
  the orchestrator implemented the UI directly (same spec). Rollback point: `backups/dashboard_2026-06-27/`.

Phases B/C/D remain queued in this doc for the next round.
