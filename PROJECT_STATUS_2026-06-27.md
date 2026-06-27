# Project Status — Analytics Engineer Website

**Date:** 2026-06-27
**Author:** PM / Orchestrator (Claude, main session)
**Method:** Full review — code vs. work plans, all handoffs, `npm run build`, git log, env + infra check.

---

## 1. Executive Summary

The site is a **Next.js 16 (App Router, React 19, Turbopack) data-analytics portfolio**.
Its centerpiece — the **5-tab convenience-store analytics dashboard** — is **feature-complete
and building cleanly**. The SuiteCRM lead-capture demo and the WhatsApp contact flow are
both built and wired.

> **Overall completion: ~90%.** What remains is **not core dashboard work** — it is one
> low-priority polish item (pipeline animation), one **deployment** task (Vercel), and one
> **unused-data opportunity** (a delivered DB table not yet surfaced).

**Build status:** ✅ `npm run build` passes — 14 routes, TypeScript clean, static pages
generated (verified 2026-06-27).

---

## 2. The Team (who owns what)

| Agent | Domain | File |
|-------|--------|------|
| **backend-engineer** | SQL, `dashboardData.js`, API routes, pg Pool, Supabase, SuiteCRM, WhatsApp | `.claude/agents/backend-engineer.md` |
| **dashboard-engineer** | Recharts components, `*TabContent` server comps, tab routing, dashboard `page.js` | `.claude/agents/dashboard-engineer.md` |
| **ui-designer** | `globals.css`, layout, color system, dark/light theme | `.claude/agents/ui-designer.md` |
| **animator** | CSS keyframes, Framer Motion, `PipelineAnimation`, micro-interactions | `.claude/agents/animator.md` |

**Orchestrator = me (main session).** I decompose by domain, spawn the right agent(s),
integrate, run `npm run build`, and verify against the DB.

> ⚠️ **Operational note:** in the 2026-06-26 session the subagents returned **0-token
> session-limit errors**, so the orchestrator implemented the global-date-filter work
> directly (same plan, same contract). Worth confirming agent quota before delegating the
> remaining tasks.

---

## 3. What's DONE ✅ (verified in code)

### Dashboard — all 5 tabs built, wired, and building
All five tabs have a fetch function in `lib/dashboardData.js`, a fetch branch in
`dashboard/page.js`, and a rendered `*TabContent` component (verified by grep):

| Tab | Data fn | Content component | Status |
|-----|---------|-------------------|--------|
| Overview | `fetchOverviewDashboardData` | (inline in `page.js`) | ✅ incl. category-aware trend, Line/Bar toggle, 9th "Dead stock" KPI |
| Sales | `fetchSalesDashboardData` | `SalesTabContent` | ✅ KPIs, trends, hourly, payment donut, returns |
| Inventory | `fetchInventoryDashboardData` | `InventoryTabContent` | ✅ KPIs, donut, histogram, scatter, action tables, **+ health-trend time-series** |
| Products | `fetchProductsDashboardData` | `ProductsTabContent` | ✅ KPIs, top-10 bar, treemap, GP scatter, ranking tables |
| Workforce | `fetchWorkforceDashboardData` | `WorkforceTabContent` | ✅ team KPIs, **winners'-podium scorecard** (client, animated), OT stacked bar, attributed-sales trend, detail table, hour-share disclaimer |

### Cross-cutting dashboard features
- **Global date filter now scopes ALL five tabs** (2026-06-26) — Overview/Sales/Workforce
  via `BETWEEN`; Inventory scopes the health-trend charts (snapshot widgets stay "latest"
  with a clarifying label); Products partial-scopes from the daily fact (GP/velocity stay
  30-day rolling, tagged). Build clean, live-verified.
- URL-based tab routing (`?tab=`) preserving filters; data fetched only for the active tab.
- All fetches use `unstable_cache` tagged **`dashboard`** → one webhook flushes every tab.
- Inventory **health-trend** time-series (`rpt_inventory_health_trend`, 96+ business days):
  dual-axis trend + stacked composition, WoW chip with inverted semantics, range selector.
- Workforce **podium scorecard** redesign: user-selectable metric (Sales/Hours/Efficiency),
  FLIP reorder, shimmer, `prefers-reduced-motion` honored, RTL Hebrew names.

### Other surfaces
- **WhatsApp lead capture** — `app/api/contact/route.js` (DB insert + template message). ✅
- **SuiteCRM integration** — `lib/suitecrmClient.js`, `app/crm/`, Navbar link. ✅
- **Payments page** + `/api/payments`, `/api/metrics`, `/api/projects`. ✅
- **Cache-revalidation webhook** — `app/api/revalidate/route.js` (secret-auth, `revalidateTag('dashboard')`). ✅
- **dbt docs viewer** — `public/dbt-docs/`. ✅
- **Env vars** — all 18 keys present in `.env.local` incl. `NEXT_REVALIDATE_SECRET`,
  WhatsApp set, SuiteCRM set. ✅

---

## 4. What's REMAINING ⬜ (steps to completion)

| # | Task | Owner | Priority | Effort | Blocker / Notes |
|---|------|-------|----------|--------|-----------------|
| **R1** | **Vercel deployment** | orchestrator | **High** (last real milestone) | 1–2h | No `vercel.json` yet; not deployed. Add all 18 env vars in Vercel dashboard. After deploy, send the pipeline owner the **prod `/api/revalidate` URL** so the nightly job can flush the cache (until then the `unstable_cache` TTL refreshes). |
| **R2** | **"Worst offenders" item table** (`rpt_item_stockout_days`) | backend + dashboard | Medium | ~1.5h | **Delivered but unused.** Pipeline shipped this table (1,992 rows, per-item stockout days/streaks) on 2026-06-25; grep confirms **zero references** in the site. Natural Inventory-tab drill-down (sortable table, status chips, availability bar, streak emphasis). See `WEBSITE_HANDOFF_item_stockout_days_2026-06-25.md` §5. Same `dashboard` cache tag → no new webhook needed. |
| **R3** | **Pipeline animation fix** | animator | Low | ~1h | `components/PipelineAnimation.jsx` exists but is **NOT imported in `app/page.js`** (grep confirms). Turbopack drops `@keyframes` from `globals.css` → use inline `<style>` in the component (or Framer Motion). Full CSS in `PIPELINE_ANIMATION_BACKUP.md`. |
| **R4** | **Visual QA pass** (small, deferred from 2026-06-15) | orchestrator | Low | ~1h | Unchecked confirm-only items: (T1) `/test-dash` hourly chart == Total-Sales KPI after the gross→net fix; (T2/T4) Overview inventory KPIs + "as of {snapshot_date}" label read correctly. Likely fine — never visually confirmed. |
| **R5** | **README + repo cleanup** | orchestrator | Low | ~30min | `TODO_REMAINING.md` is stale (still shows tabs 2–5 unchecked — all are done). Root has duplicate/`:Zone.Identifier` cruft (`SUPABASE_LOAD_REDUCTION_PLAN - Copy.md`, `.md:Zone.Identifier`). README update pending. |

### Recommended order
**R1 (deploy) → R2 (worst-offenders, best ROI on already-delivered data) → R4 (QA) →
R3 (animation) → R5 (cleanup).**

R1 unblocks the pipeline owner's nightly cache-flush (their webhook currently can't reach a
prod URL), so it is the highest-leverage next step.

---

## 5. Risks & Watch-items

- **Agent session limits** — confirm quota before delegating R2/R3; last session forced
  direct orchestrator implementation.
- **Data design caveat (carry into R2 UI):** `OUT_OF_STOCK` skews high because on-hand qty
  comes from a single-row source; lead the story with `STOCKOUT_RISK` + `avg_days_of_cover`,
  not raw OOS/units. (Already handled correctly in the inventory health-trend; repeat for
  the worst-offenders table.)
- **Enum casing** — all `velocity_band`/`stock_status` values are UPPERCASE in the DB.
- **Turbopack `@keyframes` bug** — keep keyframes inline, never in `globals.css` (relevant to R3).
- **`item_id` is TEXT** (codes like `'/'`, `'0000000121442'`) — don't parse as int in R2.

---

## 6. One-line status

> **The dashboard is done and builds clean. Ship it (R1 Vercel), then surface the one
> delivered-but-unused table (R2 worst-offenders). Everything else is low-priority polish.**
