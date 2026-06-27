# Dashboard backup — 2026-06-27 (pre-redesign / pre-fixes "v1")

Snapshot of the dashboard surface **before** the FIXES_FOR_AGENT critique work began.
Use this to roll back to the current look/behavior at any time.

## What's here
- `components/` — all `.jsx` components (full copy)
- `lib/dashboardData.js` — the entire data layer
- `app/globals.css` — full stylesheet
- `app/projects/convenience-store/dashboard/page.js` — the dashboard page

## How to restore (from repo root)
```bash
BK=backups/dashboard_2026-06-27
cp $BK/components/*.jsx components/
cp $BK/lib/dashboardData.js lib/
cp $BK/app/globals.css app/
cp $BK/app/projects/convenience-store/dashboard/page.js app/projects/convenience-store/dashboard/
```
Then `npm run build` to confirm.

## Git-native alternative (recommended once auth works)
Before starting changes, commit the current state and tag it:
```bash
git add -A && git commit -m "checkpoint: dashboard v1 before redesign"
git tag dashboard-v1
```
Roll back later with `git checkout dashboard-v1 -- <path>` or `git revert`.
