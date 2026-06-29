# Analytics Engineer Portfolio

A Next.js 16 (App Router, React 19, Turbopack) portfolio site for a data / analytics
engineer. Its centerpiece is a multi-tab analytics dashboard built on a real
convenience-store **dbt** pipeline, alongside a payments view, a SuiteCRM lead-capture
demo, and a WhatsApp contact flow.

## Quick start

```bash
npm install
npm run dev      # dev server (Turbopack) → http://localhost:3000
npm run build    # production build (use this to verify changes compile)
npm run start    # serve the production build
npm run lint     # eslint (eslint-config-next)
```

Requires a `.env.local` with the Supabase connection string and integration keys
(see "Environment" below). There is no test framework — "verifying" a change means
`npm run build` plus a manual DB query.

## The dashboard

Route: `app/projects/convenience-store/dashboard` — a Server Component with URL-based
tabs (`?tab=sales|inventory|products|workforce`, empty = Overview). It fetches only the
active tab's data. Tabs:

- **Overview** — headline KPIs, daily sales trend, top products, inventory mix, global filters (date / category / cascading item).
- **Sales** — KPIs with prior-period deltas + sparklines, trends, sales-by-hour and an hour×weekday heatmap, payment mix, returns.
- **Inventory** — leads with the action plan; health-trend over time, stock-status mix, days-of-cover, scatter, and a "chronic stockout offenders" interactive table; stock/velocity filters.
- **Products** — top products, slow movers, category gross-profit bar, sales-vs-GP scatter, ranking tables.
- **Workforce** — productivity scorecard, staffing-vs-sales by hour, daily attributed sales stacked by employee, overtime/trend (hour-share attribution, disclosed).

## Architecture

Three data clients — use the right one:

| File | Mechanism | Use for |
|------|-----------|---------|
| `lib/dashboardData.js` | own `pg` Pool | all dashboard tab fetches |
| `lib/pgClient.js` | separate `pg` Pool | `/payments` page + payment/KPI queries |
| `lib/supabaseClient.js` | `@supabase/supabase-js` | `public` schema + auth |

Direct `pg` is required because the analytics tables live in the `store_pipeline` schema,
which PostgREST does not expose. Connection string is `NEXT_DATABASE_URL` (a Supabase
transaction-mode pooler). Pool size is `DB_POOL_MAX` (default 3, tuned for serverless).

**Prod data model:** `store_pipeline` in Supabase holds only the read-set the dashboard
needs, published by DML from the dbt project (no nightly DDL). Before wiring a new
`store_pipeline` table into the UI, it must be added to the data pipeline's publish
allowlist (see `DASHBOARD_PROD_TABLE_ALLOWLIST_2026-06-28.md`).

## Other surfaces

- `app/api/contact/route.js` — lead capture: inserts to Supabase, fires a WhatsApp template message, and creates a SuiteCRM lead (`lib/suitecrmClient.js`, fire-and-forget). SuiteCRM runs locally and is not part of the cloud deployment.
- `app/payments` — payments KPIs via `lib/pgClient.js`.
- `public/dbt-docs/` — static dbt documentation site.

## Environment

Set in `.env.local` (gitignored): `NEXT_DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DB_POOL_MAX`, the WhatsApp keys
(`NEXT_WHATSAPP_*`), and the SuiteCRM keys (`NEXT_SUITCRM_*`). Never commit real values.

## Deployment

Deployed on Vercel from `main` (production). Active feature work happens on
`feature/dashboard-rich` and is promoted to `main` by fast-forward once verified.
