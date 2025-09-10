Migrations Pipeline

Overview
- GitHub Actions workflow `.github/workflows/migrations.yml` applies Supabase SQL migrations after CI succeeds or on manual trigger.
- Targets `staging` by default; can target `production` via manual dispatch and environment protection.

Secrets to Configure (GitHub → Settings → Secrets and variables → Actions)
- `SUPABASE_ACCESS_TOKEN` – Personal access token for Supabase CLI.
- `SUPABASE_PROJECT_REF_STAGING` – Project ref for staging Supabase project.
- `SUPABASE_PROJECT_REF_PRODUCTION` – Project ref for production Supabase project.

How It Runs
1) Auto: After `CI` workflow completes successfully on `main`, migrations run against `staging` (environment rules apply).
2) Manual: Trigger from Actions → Database Migrations → Run workflow; choose `staging` or `production`.

Protections
- The job uses GitHub Environments. Add required reviewers on `production` to gate migration runs.
- Concurrency prevents overlapping runs per branch/environment.

Local Equivalent
- Link and push:
  ```bash
  supabase link --project-ref $SUPABASE_PROJECT_REF
  supabase db push
  ```

Notes
- Ensure migrations in `supabase/migrations/` are ordered and idempotent where possible.
- Prefer corrective forward migrations over destructive rollbacks (see rollback runbook).

