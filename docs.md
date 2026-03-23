# 📊 DataPortfolio – Full Documentation

> A fullstack data analytics portfolio built with **Next.js 15 (App Router)**, **Supabase**, **Tailwind CSS**, and **Recharts**.  
> Showcases end-to-end analytics projects with live data from a Supabase PostgreSQL database.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Getting Started](#4-getting-started)
5. [Environment Variables](#5-environment-variables)
6. [Supabase Configuration](#6-supabase-configuration)
7. [API Routes](#7-api-routes)
8. [Pages](#8-pages)
9. [Components](#9-components)
10. [Data Layer (lib/)](#10-data-layer-lib)
11. [Styling System](#11-styling-system)
12. [Adding a New Project](#12-adding-a-new-project)
13. [Deploying to Vercel](#13-deploying-to-vercel)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Project Overview

This portfolio simulates a real-world analytics system:

```
Raw Data (POS) → dbt Transformations → Supabase (PostgreSQL)
                                               ↓
                              Next.js API Routes (Backend)
                                               ↓
                              React UI (Dashboards & Tables)
```

**Key features:**
- Live data fetched from Supabase (schema: `shlomy_store`)
- API layer that falls back to mock data if a table isn't ready yet
- Responsive modern dark UI with animated gradients
- Filterable project gallery
- Paginated payments data table with auto-detected columns
- Chart visualisation with Recharts (AreaChart)
- KPI summary cards on every major page

---

## 2. Tech Stack

| Layer        | Technology                          |
|-------------|--------------------------------------|
| Framework   | Next.js 15 (App Router, JavaScript)  |
| Database    | Supabase (PostgreSQL)                |
| Styling     | Custom CSS + Tailwind CSS utility base |
| Charts      | Recharts (AreaChart)                 |
| Data         | dbt (transformation layer)          |
| Deployment  | Vercel (recommended)                 |

---

## 3. Project Structure

```
data-portfolio/
├── app/
│   ├── layout.js               # Root layout – Navbar + footer + bg blobs
│   ├── page.js                 # Home page (Hero + KPIs + Tech stack)
│   ├── globals.css             # All custom CSS design tokens & components
│   │
│   ├── projects/
│   │   ├── page.js             # Projects gallery with search & filter
│   │   └── [id]/
│   │       └── page.js         # Single project detail page
│   │
│   ├── payments/
│   │   └── page.js             # Live payments data table (paginated)
│   │
│   └── api/
│       ├── projects/
│       │   ├── route.js        # GET /api/projects  – list all projects
│       │   └── [id]/
│       │       └── route.js    # GET /api/projects/:id
│       ├── metrics/
│       │   └── route.js        # GET /api/metrics   – revenue metrics
│       └── payments/
│           └── route.js        # GET /api/payments  – shlomy_store.payments_complete
│
├── components/
│   ├── Navbar.jsx              # Sticky navigation bar with active link
│   ├── ProjectCard.jsx         # Card with title, tech badges, insight preview
│   ├── DashboardPreview.jsx    # Recharts AreaChart (revenue + transactions)
│   ├── KpiCard.jsx             # Coloured KPI tile with glow effect
│   ├── Loader.jsx              # Animated triple-ring spinner
│   └── PaymentsTable.jsx       # Generic table with auto-detected columns
│
├── lib/
│   ├── supabaseClient.js       # Two clients: public schema & shlomy_store schema
│   ├── queries.js              # Client-side fetch helpers for all API routes
│   └── mockData.js             # Static fallback data used during development
│
├── .env.local                  # Secret environment variables (never commit)
├── docs.md                     # This file
├── next.config.mjs             # Next.js configuration
├── tailwind.config.js          # Tailwind configuration
└── package.json
```

---

## 4. Getting Started

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Installation

```bash
# 1. Navigate into the project
cd data-portfolio

# 2. Install dependencies (already done)
npm install

# 3. Create the env file (already created)
# Edit .env.local with your Supabase credentials

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for production

```bash
npm run build
npm start
```

---

## 5. Environment Variables

File: `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://wbppbatntprwjakmyumn.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=<your-anon-key>
```

| Variable                      | Description                              |
|------------------------------|------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`   | Your Supabase project URL                |
| `NEXT_PUBLIC_SUPABASE_KEY`   | Supabase `anon` public key               |

> **Security note:** These are `NEXT_PUBLIC_` variables (client-visible). Only use the `anon` key here. Never put the `service_role` key in client-side variables.

---

## 6. Supabase Configuration

### Schemas

| Schema          | Purpose                          |
|----------------|----------------------------------|
| `public`        | `projects`, `metrics_revenue`   |
| `shlomy_store`  | `payments_complete` (test data) |

### Clients in `lib/supabaseClient.js`

```js
// Default public schema
export const supabase = createClient(url, key);

// shlomy_store schema
export const supabaseStore = createClient(url, key, {
  db: { schema: 'shlomy_store' },
});
```

### Required Supabase tables

#### `public.projects`

| Column          | Type        | Notes                      |
|----------------|-------------|----------------------------|
| `id`            | integer     | Primary key                |
| `title`         | text        |                            |
| `description`   | text        |                            |
| `tech`          | text[]      | Array of tech names        |
| `category`      | text        | Sales / Finance / Marketing|
| `status`        | text        | `live` or `draft`          |
| `dashboard_url` | text        | Optional iframe URL        |
| `github_url`    | text        | Optional GitHub link       |
| `insights`      | text[]      | Array of insight strings   |
| `created_at`    | timestamptz |                            |

#### `public.metrics_revenue`

| Column         | Type    |
|---------------|---------|
| `date`         | text    |
| `revenue`      | numeric |
| `transactions` | integer |

#### `shlomy_store.payments_complete`

Your existing table — columns are auto-detected at runtime. The table is queried with:
```sql
SELECT * FROM shlomy_store.payments_complete
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
```

### Row Level Security (RLS)

Make sure RLS is either disabled for `anon` reads, or you have a policy:
```sql
-- Allow public read access
CREATE POLICY "allow_anon_read" ON shlomy_store.payments_complete
  FOR SELECT USING (true);
```

### Exposing the `shlomy_store` schema

In Supabase dashboard → **API settings** → add `shlomy_store` to the **Extra search path** list.

---

## 7. API Routes

All routes live under `app/api/`. They use Next.js Route Handlers (no Express needed).

### `GET /api/projects`

Returns an array of all projects. Falls back to `mockData.js` if the Supabase table doesn't exist.

**Response:**
```json
[
  {
    "id": 1,
    "title": "POS Sales Analytics",
    "tech": ["SQL", "dbt", "Supabase"],
    "status": "live",
    ...
  }
]
```

---

### `GET /api/projects/:id`

Returns a single project by id.

**Response:** `{ id, title, description, tech, insights, ... }`  
**Error:** `{ "error": "Project not found" }` with status 404

---

### `GET /api/metrics`

Returns monthly revenue/transaction data for charts. Falls back to mock data.

**Response:**
```json
[{ "date": "2024-01", "revenue": 42000, "transactions": 1200 }, ...]
```

---

### `GET /api/payments?limit=20&page=1`

Queries `shlomy_store.payments_complete` with pagination.

**Query parameters:**

| Param   | Default | Max | Description           |
|--------|---------|-----|-----------------------|
| `limit` | 50      | 200 | Records per page      |
| `page`  | 1       | —   | Page number (1-based) |

**Response:**
```json
{
  "data": [{ ...payment_columns... }],
  "meta": {
    "total": 4823,
    "page": 1,
    "limit": 20,
    "pages": 242
  }
}
```

**Error response:**
```json
{ "error": "relation \"shlomy_store.payments_complete\" does not exist" }
```

---

## 8. Pages

### `/` — Home

- Hero section with gradient headline
- 4 KPI cards (Revenue, Transactions, Avg. Transaction, Top Product)
- Tech stack grid

### `/projects` — Projects Gallery

- Fetches `/api/projects`
- Text search across title + description
- Tech filter pills (SQL / dbt / Python / Next.js / Supabase / Recharts)
- Grid of `<ProjectCard>` components

### `/projects/:id` — Project Detail

- Fetches `/api/projects/:id`
- Full description, tech badges, insights list
- Optional dashboard `<iframe>` embed
- GitHub link

### `/payments` — Payments Dashboard

- Fetches `/api/payments` (live Supabase data)
- KPI strip showing page-level totals
- Paginated `<PaymentsTable>` with auto-detected columns
- Error state with retry button
- Loading skeleton rows

---

## 9. Components

### `<Navbar />`

Sticky navbar with glassmorphism blur. Highlights the active route using `usePathname()`. Shows a pulsing "Live Data" badge.

**Props:** none (uses Next.js router internally)

---

### `<ProjectCard project={...} />`

Card component rendered in the projects grid.

**Props:**

| Prop      | Type   | Description               |
|----------|--------|---------------------------|
| `project` | object | Full project data object  |

Renders: category icon, status badge, title, description, tech badges, first insight, View Details + GitHub buttons.

---

### `<KpiCard icon label value sub color />`

Metric tile with a coloured glow effect.

**Props:**

| Prop    | Type   | Default  | Options                         |
|--------|--------|----------|---------------------------------|
| `icon`  | string | —        | Emoji                           |
| `label` | string | —        | Tile label                      |
| `value` | string | —        | Main display value              |
| `sub`   | string | —        | Small subtitle                  |
| `color` | string | `'blue'` | `purple`, `cyan`, `green`, `orange` |

---

### `<DashboardPreview data={[]} />`

Recharts `AreaChart` showing `revenue` and `transactions` over time.

**Props:**

| Prop   | Type  | Description                              |
|-------|-------|------------------------------------------|
| `data` | array | Array of `{ date, revenue, transactions }` |

---

### `<Loader text="..." />`

Animated triple-ring spinner with optional loading text.

**Props:**

| Prop   | Type   | Default           |
|-------|--------|-------------------|
| `text` | string | `'Loading data...'` |

---

### `<PaymentsTable payments={[]} loading={false} />`

Generic data table. Columns are derived automatically from the first row's keys — no hardcoded schema needed.

**Props:**

| Prop       | Type    | Default | Description              |
|-----------|---------|---------|--------------------------|
| `payments` | array   | `[]`    | Array of row objects     |
| `loading`  | boolean | `false` | Shows skeleton rows      |

Formats:
- Columns with `amount / total / price / sum` → currency `₪XX,XXX.XX`
- Columns with `date / time / created` → `DD/MM/YYYY`
- Columns with `status` → coloured status badge

---

## 10. Data Layer (lib/)

### `lib/supabaseClient.js`

Exports two Supabase clients:
- `supabase` — default public schema
- `supabaseStore` — scoped to `shlomy_store` schema

### `lib/queries.js`

Client-side helpers that call the app's own API routes (not Supabase directly):

```js
getProjects()           // → GET /api/projects
getProjectById(id)      // → GET /api/projects/:id
getMetrics()            // → GET /api/metrics
getPayments({ limit, page })  // → GET /api/payments
```

### `lib/mockData.js`

Static fallback arrays:
- `mockProjects` — 3 sample projects
- `mockMetrics` — 6 months of revenue data
- `mockKpis` — homepage KPI values

The API routes automatically serve mock data if a Supabase table is missing, so the UI always looks populated during development.

---

## 11. Styling System

All styles live in `app/globals.css`. The project uses **CSS custom properties (variables)** for theming rather than Tailwind utility classes for layout/components — this keeps the design consistent and easy to update.

### Color tokens

```css
--purple:  #6366f1   /* Primary accent */
--cyan:    #22d3ee   /* Secondary accent */
--green:   #4ade80   /* Success / live */
--orange:  #fb923c   /* SQL badge */
--pink:    #ec4899   /* Decorative blob */
--yellow:  #facc15   /* Python badge */
```

### Background layers

```css
--bg-base:    #080b14   /* Page background */
--bg-surface: #0e1320   /* Section background */
--bg-card:    #121829   /* Card background */
```

### Animated background blobs

Three absolutely-positioned blurred circles (`bg-blob-1/2/3`) create the ambient glow effect using a `blobFloat` keyframe animation. They are hidden under `z-index: 0` and do not intercept any UI events.

---

## 12. Adding a New Project

### Option A — Supabase (recommended for production)

1. Go to Supabase → Table Editor → `public.projects`
2. Insert a new row with all required columns
3. The `/api/projects` route will serve it automatically

### Option B — Mock data (development)

Open `lib/mockData.js` and add an entry to `mockProjects`:

```js
{
  id: 4,
  title: 'My New Project',
  description: 'What this project does...',
  tech: ['Python', 'SQL'],
  category: 'Analytics',
  status: 'live',
  dashboard_url: '',
  github_url: 'https://github.com/...',
  insights: ['Key finding 1', 'Key finding 2'],
  created_at: '2024-04-01',
}
```

---

## 13. Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import
3. Set environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_KEY`
4. Deploy — Vercel auto-detects Next.js

No server config needed. API routes are deployed as serverless functions automatically.

---

## 14. Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Payments page shows error | `shlomy_store` schema not exposed in Supabase API settings | Add `shlomy_store` to **Extra search path** in Supabase → API |
| `relation does not exist` | Schema not exposed or wrong schema name | Verify in Supabase SQL editor: `SELECT * FROM shlomy_store.payments_complete LIMIT 1;` |
| Projects show mock data only | `public.projects` table doesn't exist | Create the table in Supabase or use mock data intentionally |
| Styles look broken | Tailwind purging custom classes | All styles are in `globals.css` using plain CSS — no Tailwind purge issue |
| Blank page on `/payments` | RLS blocking anon reads | Disable RLS or add `allow_anon_read` policy on the table |
| `NEXT_PUBLIC_` vars undefined | `.env.local` missing or wrong key name | Double-check the variable names — they must start with `NEXT_PUBLIC_` |

---

*Last updated: 2026-03-23 | Stack: Next.js 15 · Supabase · Recharts · CSS Custom Properties*
