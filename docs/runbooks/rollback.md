Rollback Runbook

Principles

- Prefer forward fixes for application code. Use DB rollbacks only when necessary.
- Roll back app, functions, and database independently based on the failure domain.

When to Roll Back

- Error rate > agreed threshold (e.g., >1–2% for ≥10 min)
- Critical API latency regression (e.g., p95 > 1s sustained)
- Data corruption detected or destructive migration error

1. Application Rollback

- Vercel:
  - Use the dashboard “Promote previous deployment” or CLI: `vercel rollback <deployment-url>`
  - Verify env vars unchanged; rollbacks reuse existing env
- Other hosting:
  - Re-deploy previous tag/commit:
    - `git checkout <previous-stable-tag>`
    - `npm run build && npm run start` (or your container/orchestrator rollback)
- Validate:
  - Smoke test key routes and an API endpoint
  - Watch Sentry for error drop to baseline

2. Edge Functions Rollback

- Re-deploy the previous version from a known-good commit:
  - `git checkout <prev-stable>`
  - `supabase functions deploy <name> --project-ref <ref>`
- If multiple functions changed, roll back only those implicated by errors
- Validate by invoking the function or recreating the failing path

3. Database Rollback
   Important: Supabase migrations in this repo are forward-only SQL files. Use one of these strategies:

- Best (if available): PITR (Point‑in‑Time Recovery)
  - Use Supabase PITR to restore the database to a timestamp immediately before the bad migration
  - High impact: affects entire project. Ensure app is in maintenance mode during restore

- If PITR is not available: Corrective Migration (preferred over ad-hoc edits)
  - Author a new migration that reverses the schema change (e.g., re-add a dropped column with appropriate defaults, revert renames)
  - Example skeleton:
    ```sql
    -- 2025XXXXXXXXXX_revert_bad_change.sql
    begin;
    -- Recreate column
    alter table public.example add column if not exists old_col text;
    -- Optionally backfill from surviving data
    -- update public.example set old_col = new_col where old_col is null;
    commit;
    ```
  - Apply via dashboard or `supabase db push`

- Data Recovery from Dump
  - If you have a recent export, restore affected tables/rows selectively using SQL INSERTs from the dump

Validation After DB Rollback

- Run sanity queries: counts on key tables, required constraints present
- Re-run impacted API flows end-to-end

4. Communication & Follow‑up

- Document incident timeline, root cause, mitigation, and action items
- Add guardrails (tests, checks, dashboards) to prevent recurrence

Quick Decision Matrix

- App only failing: Roll back app
- Edge function failing: Roll back that function
- Schema mistake without data loss: Corrective migration
- Data corruption or destructive change: PITR (if enabled) or restore from backup

Useful Commands

- Vercel rollback: `vercel rollback <deployment-url>`
- Supabase functions deploy: `supabase functions deploy <name> --project-ref <ref>`
- Apply corrective migration: `supabase db push`
