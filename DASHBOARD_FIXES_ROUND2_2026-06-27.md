# Dashboard Fixes — Round 2 (P2/P3) — 2026-06-27

**Trigger:** `WEBSITE_HANDOFF_dashboard_fixes_2026-06-27.md` — the data agent's reply to our
`PIPELINE_HANDOFF_REQUEST_2026-06-27.md`. It (a) re-verifies our Phase A work and (b) delivers the
data needed for the deferred items.
**Companion docs:** `DASHBOARD_FIXES_PLAN_2026-06-27.md` (Phase A, DONE) ·
`DASHBOARD_REDESIGN_PLAN_2026-06-27.md` (per-tab purpose/audience).
**Backup / rollback point:** `backups/dashboard_2026-06-27/`.
**Discipline (per CLAUDE.md):** every change → `npm run build` + a manual DB check → orchestrator
review → checkpoint. Read `rpt_*` tables only.

---

## 0. Phase A reconciliation vs the data agent's authoritative answers

| # | Phase A action | Data-agent verdict | Residual |
|---|---|---|---|
| 1 | Rounded unit counts in display | ✅ Correct — decimals are real (weighed goods). | *Optional:* a kg column for weighed measures. Defer. |
| 2a | Both views read one field `avg_days_of_cover_30d` (latest snapshot) | ✅ Correct ("pick one, use everywhere"). Mean ≈129 vs median ≈50 is skew, not a bug. | **Upgrade (gated):** switch headline to `median_days_of_cover_30d` when it ships (data Stage 1A, prod). Label mean as "mean (skewed by overstock)". |
| 2b | Products KPI relabeled "Slow & dead movers"; Inventory/Overview "Dead stock" = `DEAD_STOCK` (508) | ✅ Two legitimate metrics. | *Minor:* their clean split is **"Dead stock (508)"** vs **"No recent sales (1,940 = `NO_RECENT_SALES`)"**. Our composite (SLOW+NO_RECENT+OOS) is broader — keep, but verify the label reads honestly. Adopt `no_recent_sales_count` when it ships. |
| 3 | Labeled Workforce cards "All time · …" | ✅ Accepted ("if you keep all-time, label it"). | *Optional enhancement:* make Workforce cards respect the global date filter (then Σ = store net over the window). |
| 4 | Filtered one orphan (`item_id='/'`, "Unknown Item") | ✅ Orphan `item_id`s = known POS-deletion noise. | Verify no other orphans leak into tables; adopt data Stage 1D label `(unmapped item)` / `(uncategorized)` when it ships. |
| 16 | — | KEEP the hour-share attribution caveat. | Verify it's still present in `WorkforceTabContent.jsx`. No code. |

---

## Phase B — P2 clarity (website-only, **no data blockers** → do now)

| # | Task | Owner agent | Acceptance |
|---|---|---|---|
| 9 | Inventory tab **leads with the action plan** — move `InventoryActionTable` (reorder/overstock/dead) above the analytical charts. | dashboard-engineer | Action table is the first section after the KPI strip; charts follow. |
| 7 | Replace `CategoryTreemap` with a **sorted horizontal Gross-Profit bar** (data already in `categoryData[].profit`). | dashboard-engineer | New `CategoryGrossProfitBar` (or equiv) sorted desc by GP; treemap removed from Products tab; build clean. |
| 6 | One plain-language **"so what" caption** per chart (copy supplied by data agent — see handoff #6). | dashboard-engineer (copy) + ui-designer (caption style) | Each major chart shows a single takeaway line in a consistent style. |
| 8 | **Cap long tables** to top 10–15 with a "show all" expander (reorder ~1019, scatter 100, category 28). | dashboard-engineer | Tables render capped by default; expander reveals the rest; no layout break. |
| 5 | **Visual hierarchy** per view (lead element large, secondary below the fold) on Inventory + Products. | ui-designer + dashboard-engineer | Clear primary element per tab; secondary panels visually de-emphasized. |
| 14 | **Quadrant labels** on the two scatters (Inventory: overstock/reorder; Products: high-sales/low-margin). Frontend-only. | dashboard-engineer | Each scatter readable without the caption. |

## Phase C — P3 polish

| # | Task | Owner agent | Status / gate |
|---|---|---|---|
| 11 | **Sparklines** in KPI cards (existing daily series — no new data). | dashboard-engineer | Unblocked. |
| 10 | **Direction arrows on ALL KPI cards** (% vs prior period). Prior-period deltas derivable from the daily series. | backend-engineer (deltas) + dashboard-engineer (chips) | Unblocked (no new mart; `rpt_kpi_summary` is optional/not built). |
| 13 | **Return RATE per product** (not absolute). | backend-engineer + dashboard-engineer | **Decision C** — in-repo join (`rpt_returns_analysis_daily` ↔ `rpt_product_velocity`, mind window) *or* request clean `rpt_product_returns`. |
| 12 | **Hour × weekday heatmap** — new component on `rpt_sales_by_hour_weekday` (168 rows, dict in handoff). | dashboard-engineer (+ backend fetch) | **GATED — Decision A.** Mart is on data **dev** only; needs prod deploy before it can render. |
| 15 | **Staffing vs sales by hour** — new component on `rpt_staffing_vs_sales_by_hour` (24 rows; surfaces "unstaffed trading" overnight). | dashboard-engineer (+ backend fetch) | **GATED — Decision A.** Same prod-deploy gate. |

---

## Decisions for the owner (these change scope)

- **A — Prod deploy of the two new marts (#12/#15).** They're built & tested on the data agent's
  **dev**, but our site queries Supabase **prod** (`store_pipeline`). They cannot render until the
  data agent deploys them to prod (with the `dashboard` cache tag). → *Approve the deploy now* (build
  #12/#15 this round) **or** *defer* them.
- **B — Median days of cover (data Stage 1A).** Request `median_days_of_cover_30d` so the days-of-cover
  headline is robust to overstock outliers? (Recommended; folds into #2a when it lands.)
- **C — Return-rate approach (#13).** In-repo join now (fast, but mixes all-time returns with 30-day
  sold-qty — caveat required) **vs** request a clean `rpt_product_returns` (same-window numerator+
  denominator, waits on data) **vs** skip this round.

## Agent ownership at a glance
- **dashboard-engineer** — lead for B (all) + C #11/#12/#15 UI + chips/labels.
- **backend-engineer** — fetch fns for #12/#15, prior-period deltas (#10), return-rate join (#13).
- **ui-designer** — caption style (#6) + hierarchy (#5).
- **animator** — optional sparkline/caption motion only (idle this batch).

## Recommended order
B #9 → #7 → #14 → #6 → #8 → #5, then C #11 → #10 → #13 → (#12/#15 once prod-deployed).
Each item: implement → `npm run build` → DB check → review → checkpoint.

---

## ✅ EXECUTION LOG — 2026-06-27 (build clean, marts DB-verified)

Decisions taken: **A** = build #12/#15 now (marts turned out to be already in prod —
`rpt_sales_by_hour_weekday` 168 rows, `rpt_staffing_vs_sales_by_hour` 24 rows, verified live).
**B** = median is already on the data team's Stage 1A roadmap → consume when it lands (no request needed).
**C** = request clean `rpt_product_returns` (see `WEBSITE_TO_DATA_reply_2026-06-27.md`) → #13 deferred.
**Scope** = all unblocked B + C.

| # | Done | Notes |
|---|---|---|
| 9 | ✅ | Inventory leads with `InventoryActionTable`, charts below. |
| 7 | ✅ | New `CategoryGrossProfitBar` (sorted desc, per-category color); treemap removed from Products (file kept, unused). |
| 14 | ✅ | Quadrant labels on `ProductScatterChart` + `InventoryScatterChart`. |
| 12 | ✅ | New `SalesHourWeekdayHeatmap` (CSS-grid, `avgPerOccurrence` intensity) on Sales; backend `hourWeekdayHeatmap`. |
| 15 | ✅ | New `StaffingVsSalesChart` (ComposedChart; "unstaffed trading" overnight flag) on Workforce; backend `staffingVsSales`. Attribution caveat (#16) kept. |
| 10 | ✅ | Direction chips on all 5 Sales KPIs (return-rate inverted); Inventory stockout-risk WoW chip (inverted). Redundant "Vs previous period" card removed. Products/Workforce/Overview left without chips (no prior-period source — not fabricated). |
| 11 | ✅ | Sparklines on Sales Net-sales + Avg-ticket (`KpiSparkline`). Others skipped — would need a backend per-KPI mini-series (flagged, not built). |
| 8 | ✅ | `ShowMoreTable` (default 12 + toggle) on reorder/overstock/dead-stock, category ranking, slow movers, returns. |
| 6 | ✅ | `.od-chart-caption` "so what" line normalized across major charts (honest/generic copy, no hardcoded category names). |
| 5 | ✅ | `.od-section--lead` / `--secondary` / `--supporting-start` hierarchy across all four tabs (additive CSS, light theme preserved). |

**Backend additions** (`lib/dashboardData.js`, additive only): `hourWeekdayHeatmap`, `staffingVsSales`,
Sales KPI deltas (`unitsDeltaPct`, `ticketsDeltaPct`, `avgTicketDeltaPct`, `returnRateDeltaPct`).
`queryOptional` helper added for missing-table resilience.

**Carried to next round (data-dependent):**
- #13 return-rate per product — waiting on `rpt_product_returns`.
- #2a median days-of-cover — switch headline when `median_days_of_cover_30d` ships (Stage 1A).
- #2b `no_recent_sales_count`, #4 `(unmapped item)` dim labels — adopt when shipped.
- Universal KPI chips/sparklines (Products/Workforce/Overview) — needs a backend per-KPI mini-series.
- #3 optional: make Workforce cards filter-responsive (currently labeled all-time).
