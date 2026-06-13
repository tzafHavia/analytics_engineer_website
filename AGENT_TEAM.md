# Agent Team — Analytics Engineer Website

**Project Manager / Orchestrator:** Claude (main session)  
**Last updated:** 2026-06-09 (category-aware trend + Line/Bar toggle)

---

## The Team

| Agent | File | Domain | When to Invoke |
|-------|------|--------|----------------|
| **ui-designer** | `.claude/agents/ui-designer.md` | CSS, globals.css, responsive layout, color system, dark/light theme, component appearance | "Make this look better", "add a color variant", "fix the mobile layout", "new CSS class needed" |
| **animator** | `.claude/agents/animator.md` | CSS keyframes, Framer Motion, PipelineAnimation, micro-interactions, scroll effects | "Fix the animation", "add a transition", "the pipeline animation doesn't work", "make the cards animate in" |
| **backend-engineer** | `.claude/agents/backend-engineer.md` | SQL queries, dashboardData.js, API routes, pg Pool, Supabase, SuiteCRM, WhatsApp | "Fetch data from this table", "add a new API endpoint", "the query returns wrong results", "add workforce data function" |
| **dashboard-engineer** | `.claude/agents/dashboard-engineer.md` | Recharts components, tab content server components, tab routing, dashboard page.js | "Build the workforce tab", "add a new chart", "wire up the data to the component", "create a scatter chart" |

---

## Orchestration Rules (How I Manage the Team)

### Task Decomposition
When you give me a task, I:
1. Break it into sub-tasks by domain
2. Spawn the right agent(s) — sometimes multiple in parallel
3. Integrate the outputs and verify they fit together
4. Report back what was done

### Typical Task Flow Example
> User: "Build the Workforce tab"

I would:
1. **backend-engineer** → `fetchWorkforceDashboardData()` in dashboardData.js
2. **dashboard-engineer** → `WorkforceTabContent.jsx`, `EmployeeBarChart.jsx`, `EmployeeScatterChart.jsx`, wire into page.js
3. **ui-designer** → Add disclaimer banner CSS, any missing KPI card variants
4. I (orchestrator) → verify all three integrate, run `npm run dev`, confirm tab works

---

## Current Work Status

### Done ✅
- Overview Tab — full data + UI
- Sales Tab — full data + UI
- Inventory Tab — full data + UI
- Products & Categories Tab — full data + UI
- Tab navigation shell (URL-based routing)
- Global filters (date, category, item, stock, velocity)
- **Category-aware Overview trend + Line/Bar toggle** (2026-06-09) — selecting a
  category/item rescopes the KPIs, trend, delta and daily table via
  `int_sales__daily_product` + `dim_product`
- Design-system palette applied (blue/teal/purple per the spec PDF)
- dbt Docs viewer (`/dbt-docs/index.html` with manifest + catalog)

### Pending ⬜ (in priority order)

| # | Task | Assigned Agent(s) | Effort |
|---|------|-------------------|--------|
| 1 | **Workforce Tab** — data layer | backend-engineer | ~2h |
| 2 | **Workforce Tab** — UI components | dashboard-engineer + ui-designer | ~2h |
| 3 | **Pipeline Animation fix** | animator | ~1h |
| 4 | **Dead Stock KPI on Overview** | backend-engineer + dashboard-engineer | ~30min |
| 5 | **Deployment to Vercel** | (orchestrator) | ~1h |

---

## Key Technical Constraints (All Agents Must Know)

1. **Next.js 16.2.1 App Router** — Server Components by default; `'use client'` required for any interactivity or Recharts
2. **Schema:** All analytics tables are in `store_pipeline` schema, NOT `public`
3. **Enum values are UPPERCASE** in the DB: `OUT_OF_STOCK`, `STOCKOUT_RISK`, `NO_RECENT_SALES`, `FAST`, `STEADY`, `SLOW`, `DEAD_STOCK`
4. **Turbopack CSS keyframe bug** — never put `@keyframes` in `globals.css`; use inline `<style>` in the component
5. **pg Pool, not Supabase JS** — for all `store_pipeline` queries
6. **Parallel queries** — always use `Promise.all([...])` for multiple fetches

---

## How to Run the Project

```bash
# Development
npm run dev
# → http://localhost:3000

# Key pages
http://localhost:3000/                                          # Home (hero, tech stack, projects)
http://localhost:3000/projects/convenience-store               # Project detail page
http://localhost:3000/projects/convenience-store/dashboard     # Dashboard (Overview tab)
http://localhost:3000/projects/convenience-store/dashboard?tab=sales
http://localhost:3000/projects/convenience-store/dashboard?tab=inventory
http://localhost:3000/projects/convenience-store/dashboard?tab=products
http://localhost:3000/dbt-docs/index.html                      # dbt documentation viewer
```

---

## Project File Map

```
analytics_engineer_website/
├── app/
│   ├── globals.css                          ← ui-designer owns
│   ├── layout.js                            ← shared
│   ├── page.js                              ← home page
│   ├── api/
│   │   ├── contact/route.js                 ← backend-engineer (WhatsApp + CRM)
│   │   ├── payments/route.js                ← backend-engineer
│   │   ├── metrics/route.js                 ← backend-engineer
│   │   └── projects/route.js                ← backend-engineer (static)
│   ├── crm/page.js                          ← shared
│   ├── payments/page.js                     ← shared
│   └── projects/
│       └── convenience-store/
│           ├── page.js                      ← project detail page
│           └── dashboard/
│               └── page.js                  ← dashboard-engineer owns
├── components/
│   ├── DashboardTabNav.jsx                  ← dashboard-engineer
│   ├── *TabContent.jsx                      ← dashboard-engineer
│   ├── *Chart.jsx                           ← dashboard-engineer
│   ├── PipelineAnimation.jsx                ← animator owns
│   ├── Navbar.jsx                           ← ui-designer
│   └── ...
├── lib/
│   ├── dashboardData.js                     ← backend-engineer owns
│   ├── pgClient.js                          ← backend-engineer owns
│   ├── supabaseClient.js                    ← backend-engineer owns
│   └── suitecrmClient.js                    ← backend-engineer owns
└── public/
    └── dbt-docs/
        ├── index.html                       ← static (generated by dbt)
        ├── manifest.json                    ← regenerate with: dbt docs generate
        └── catalog.json                     ← then copy from store_pipeline/target/
```
