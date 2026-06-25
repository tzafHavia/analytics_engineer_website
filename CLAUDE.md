# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Dev server (Turbopack) → http://localhost:3000
npm run build    # Production build — run this to verify changes compile
npm run start    # Serve the production build
npm run lint     # ESLint (eslint-config-next)
```

No test framework is configured — there are no unit/integration tests. "Verifying" a change means `npm run build` plus a manual DB query (see below).

### Querying / introspecting the database

`dotenv` is **not** installed, so ad-hoc scripts must parse `.env.local` manually before connecting:

```bash
node -e "
const fs = require('fs');
for (const line of fs.readFileSync('.env.local','utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*\$/);
  if (m) process.env[m[1]] = m[2].replace(/^[\"']|[\"']\$/g,'');
}
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.NEXT_DATABASE_URL, ssl: { rejectUnauthorized: false } });
p.query('SELECT ...').then(r => { console.log(r.rows); p.end(); });
"
```

You can also import the data layer directly in such a script (e.g. `require('./lib/dashboardData.js')`) to test a fetch function end-to-end.

## Architecture

A Next.js 16 App Router data-analytics **portfolio** site (React 19, Turbopack). Its centerpiece is a multi-tab analytics dashboard for a convenience-store dbt pipeline, plus a SuiteCRM lead-capture demo and a WhatsApp contact flow.

### Three data clients — know which to use

| File | Mechanism | Use for |
|------|-----------|---------|
| `lib/dashboardData.js` | own `getPool()` (pg) | **all dashboard tab fetches** — `fetchOverviewDashboardData`, `fetchSalesDashboardData`, `fetchInventoryDashboardData`, `fetchProductsDashboardData`, filter options |
| `lib/pgClient.js` | separate pg `Pool` | `/payments` page + payment/KPI queries |
| `lib/supabaseClient.js` | `@supabase/supabase-js` | `public` schema + auth only |

Direct `pg` is required because PostgREST (Supabase's REST API) only exposes the `public` schema, while **all analytics tables live in the `store_pipeline` schema**. The two pg files each own a private pool — they do not share one. Connection string is `NEXT_DATABASE_URL` (currently a Supabase Transaction-mode pooler: `max: 10`, `idleTimeoutMillis`, `connectionTimeoutMillis`).

### Database conventions (`store_pipeline`)

- **All `velocity_band` / `stock_status` enum values are UPPERCASE**: `FAST`, `STEADY`, `SLOW`, `NO_RECENT_SALES`, `OUT_OF_STOCK`, `STOCKOUT_RISK`, `OVERSTOCK`, `DEAD_STOCK`. Compare with UPPERCASE literals in SQL; the JS layer often lowercases for display. Assuming lowercase has caused real bugs (empty inventory KPIs).
- Sales queries anchor to `MAX(sale_date)` then default to a trailing 30-day window. Inventory queries filter to `MAX(snapshot_date)` (snapshot-based, not date-filtered). 30-day product/category tables (`rpt_*_30d`) ignore the date filter entirely.
- **Inventory time-series exception:** `rpt_inventory_health_trend` (added 2026-06-25) is the one inventory table with a real per-business-day series (`snapshot_date` is a `timestamp` — normalize with `toIsoDate`). Powers the Inventory-tab "health over time" charts (`InventoryHealthTrendChart`, `InventoryStatusCompositionChart`) via `healthTrend[]`/`healthTrendSummary` in `fetchInventoryDashboardData`. Note: `out_of_stock_count` + `total_inventory_units` are flat by design — lead with `stockout_risk_count` + `avg_days_of_cover_30d`; rising `at_risk` is *bad* (inverted WoW chip).
- **No `rpt_` table has date × category granularity.** For a category/item-scoped daily series, join the daily-product fact to the product dim: `int_sales__daily_product` (`sale_date, item_id, net_sales_amount, sold_qty, tickets_count`) `JOIN dim_product` (`item_id → category_name`, item_id is unique). See the `isScoped` branch in `fetchOverviewDashboardData`.
- `rpt_workforce_productivity_summary` **now exists** (added 2026-06-25): one ranked row per employee (hours, overtime tiers, payroll, attributed sales, efficiency, recent-form 7d, three diverging ranks). `employee_name` is **Hebrew (RTL)** — render with `dir="rtl"`. Pair with the per-day `rpt_employee_productivity` (`shift_date, employee_id, hours_worked, sales_amount, sales_per_hour`) for the trend detail. Attributed sales are estimated by worked-hour share (disclaimer required on the tab).

### Dashboard tab system

Route: `app/projects/convenience-store/dashboard/page.js` — a **Server Component**. Tabs are URL-based via `?tab=sales|inventory|products|workforce` (empty = Overview). The page reads `searchParams.tab`, fetches **only the active tab's data**, and conditionally renders a `*TabContent` component. `components/DashboardTabNav.jsx` (`'use client'`, wrapped in `<Suspense>`) preserves all active filter params when switching tabs.

Component split:
- `*TabContent.jsx` — **server** components (no `'use client'`): KPI cards → charts → tables layout.
- `*Chart.jsx` — **client** components; every Recharts chart needs `'use client'`. Reuse before adding: `OverviewTrendChart` (Line/Bar toggle via `ComposedChart`), `OverviewTopProductsChart`, `PaymentMixDonut`, `InventoryStatusDonut`, etc.

All five tabs are now built. Workforce (`WorkforceTabContent` + `EmployeeOvertimeChart` + `EmployeeTrendChart` + `fetchWorkforceDashboardData`, `wf-` CSS prefix) was the last, completed 2026-06-25.

### Styling & design system

- Single global stylesheet `app/globals.css` (~2.6k lines, Tailwind v4 via `@import "tailwindcss"`) with a CSS-variable design system and a `[data-theme="light"]` override block. **Always use the CSS variables** (`--bg-base`, `--text-primary`, `--blue`, `--teal`, `--analytics-purple`, …) — hardcoded hex on text/cards breaks the light theme. Recharts colors are the exception (hardcoded in JSX).
- Palette follows `Analytics Engineer Portfolio Design System.pdf`: primary blue `#4F8CFF`, accent teal `#00D4AA`, analytics purple `#A855F7`. `--purple`/`--cyan` are kept as aliases (→ blue/teal) for existing class names.
- Class prefixes: `od-` (overview dashboard), `dash-` (KPI/tab nav), `inv-` (inventory), `cs-` (project page), `crm-`, `pa-` (pipeline animation).
- **Turbopack CSS bug:** never add `@keyframes` to `globals.css` — they are silently dropped at runtime. Put keyframes in an inline `<style>` inside the component, or use Framer Motion.

### Next.js 16 specifics

`searchParams`/`params` are async in this version — `await` them in pages. Per `@AGENTS.md`, treat APIs as potentially changed from training data and consult `node_modules/next/dist/docs/` when unsure.

### Agent team

`.claude/agents/` defines four subagents (`ui-designer`, `animator`, `backend-engineer`, `dashboard-engineer`); `AGENT_TEAM.md` is the orchestration map and file-ownership index. Each agent doc carries the domain-specific gotchas above. Only spawn them when the user explicitly asks.

### Other surfaces

- `app/api/contact/route.js` — lead capture: inserts to Supabase, fires a WhatsApp template message, and creates a SuiteCRM lead (`lib/suitecrmClient.js`).
- `public/dbt-docs/` — static dbt documentation site. To refresh: run `dbt docs generate` in the pipeline project, then copy `target/manifest.json` + `target/catalog.json` into this folder (`index.html` fetches them client-side).
- Work is tracked in `WORK_PLAN_<date>.md` (rename to the current date when updating).
