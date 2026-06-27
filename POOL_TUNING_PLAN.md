# Pool Tuning Plan (R1 sub-task) — 2026-06-27

**Goal:** make the pg connection pools safe for Vercel serverless before deploy, and make
`max` **env-tunable** so `max=1` can be tested empirically.
**Owner of code:** backend-engineer. **Supervisor:** orchestrator.
**Files:** `lib/dashboardData.js`, `lib/pgClient.js` (+ `.env.local`, docs).

---

## Background (verified in code 2026-06-27)

- `lib/dashboardData.js` `getPool()` passes **only** `connectionString` → pg defaults:
  `max=10`, `connectionTimeoutMillis=0` (**infinite wait — hangs the request**),
  `idleTimeoutMillis=10000`. Queries via `pool.connect()` per query; fetch fns fire 5–6 in
  parallel (`Promise.all`).
- `lib/pgClient.js` pool: explicit `max=10`, `idleTimeoutMillis=10000`,
  `connectionTimeoutMillis=5000`, `ssl:{rejectUnauthorized:false}`. Also 5 parallel queries.
- Active DB URL = Supabase **transaction pooler** (`...pooler.supabase.com:6543`) — multiplexes
  many clients; tolerant of a low per-instance `max`.

## Why
On Vercel, total Postgres connections ≈ (warm instances) × `max`. `max=10` risks exhaustion;
`connectionTimeoutMillis=0` turns a stuck acquire into an infinite hang. `max=1` is safest for
count but **serializes** the parallel queries (one connection = one query at a time) → slower
renders. Sweet spot: **`max=3`**, env-overridable so `max=1` is testable.

---

## Phase 1 — Unify + parameterize pool config  ·  backend-engineer

Apply the **same** config object to both pools, reading `max` from env:

```js
max: Math.max(1, Number(process.env.DB_POOL_MAX) || 3),
idleTimeoutMillis: 10000,
connectionTimeoutMillis: 10000,   // finite — fail fast instead of hanging; covers serialized
                                  //          acquires when max is very low (e.g. =1)
ssl: { rejectUnauthorized: false },
```

1. `lib/dashboardData.js` `getPool()` — add the four options above (currently has none).
2. `lib/pgClient.js` pool — replace `max: 10` with the env-driven `max`; bump
   `connectionTimeoutMillis` 5000 → 10000; keep `idleTimeoutMillis`, `ssl`.
3. Keep the module-level singleton pattern in both (do **not** create a pool per request).
4. `.env.local` — add a documented `DB_POOL_MAX=3` line (optional; default 3 if unset).

**Constraints:** no behavior change to query logic; singletons preserved; `DB_POOL_MAX`
clamped to ≥1; do not commit secrets.

## Phase 2 — Verify  ·  backend-engineer

1. `npm run build` — clean.
2. Live DB test (use the `.env.local`-parsing node snippet from CLAUDE.md) against the pooler:
   - With `DB_POOL_MAX=3`: call `fetchOverviewDashboardData()` end-to-end → returns real rows.
   - With `DB_POOL_MAX=1`: same call → still returns identical correct data (proves `max=1`
     works; queries serialize but complete within `connectionTimeoutMillis`).
   - Confirm no "timeout exceeded when trying to connect" thrown in either run.
3. Report: the diff, both run results, and observed timing if available.

## Phase 3 — Review & decide default  ·  orchestrator

- Review the diff for correctness + singleton integrity.
- Confirm both `max` values returned data; pick the **prod default** (recommend 3) and the
  Vercel `DB_POOL_MAX` value to set at deploy.
- Update CLAUDE.md pool note (currently says dashboardData pool sets max/timeouts — it didn't)
  and `WORK_PLAN_2026-06-27.md` Risk K1.

---

## Decision for the owner (after Phase 2)
Pick the production `DB_POOL_MAX`: **3 (recommended)** vs **1 (max safety, slower renders)** —
informed by the Phase 2 timing. Set it in the Vercel dashboard at deploy.
