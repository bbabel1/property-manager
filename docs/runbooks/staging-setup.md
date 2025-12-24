Staging Setup & CI/CD Integration

<!-- markdownlint-configure-file {"MD013": false, "MD029": false, "MD031": false} -->

Goal

- Create a Supabase staging project, apply schema, and connect to CI/CD so migrations and Edge Functions deploy via GitHub Actions.

1. Create Supabase Staging Project

- In Supabase Dashboard → New Project
  - Name: property-manager-staging
  - Copy the Project URL + Project Ref (the 20-char ref in the URL)

2. Configure GitHub Secrets

- Repo Settings → Secrets and variables → Actions → New repository secret:
  - `SUPABASE_ACCESS_TOKEN` (Supabase account access token)
  - `SUPABASE_PROJECT_REF_STAGING` (staging ref, e.g., cidfgplknvueaivsxiqa)
  - (Add production equivalents later if/when needed)

3. Create GitHub Environments

- Settings → Environments → New environment `staging` (and `production` later)
- Optional: add reviewers/approvals for `production`

4. Apply Migrations to Staging

- From Actions → select “Database Migrations” → Run workflow → environment=staging
- Behind the scenes this runs: `supabase link --project-ref <ref>` then `supabase db push`

5. Deploy Edge Functions to Staging

- From Actions → select “Edge Functions Deploy” → Run workflow → environment=staging
- This deploys all directories under `supabase/functions/*`

6. Configure Staging App Environment (when you choose hosting)

- Set app env vars (Preview/Production as needed):
  - `NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging anon key>`
  - Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `BUILDIUM_*`, `SENTRY_DSN`, `OTEL_*`, etc.
- Supabase Edge Function Secrets (per project):
  ```bash
  supabase link --project-ref <staging-ref>
  supabase secrets set \
    BUILDIUM_CLIENT_ID=... \
    BUILDIUM_CLIENT_SECRET=... \
    BUILDIUM_CLIENT_ID=... \
    BUILDIUM_CLIENT_SECRET=... \
    BUILDIUM_WEBHOOK_SECRET=... \
    SUPABASE_SERVICE_ROLE_KEY=... \
    SUPABASE_URL=https://<staging-ref>.supabase.co
  ```

7. CI/CD Flow (recommended)

- On push/PR: CI runs lint → typecheck → tests → build
  - .github/workflows/ci.yml
- On CI success on `main`: “Database Migrations” runs (staging) automatically
  - .github/workflows/migrations.yml
- After migrations succeed: “Edge Functions Deploy” runs (staging) automatically
  - .github/workflows/edge-functions.yml

8. Verify

- In Supabase SQL editor, run `select now();` and a simple table query to confirm schema.
- Invoke an Edge Function or hit a webhook path and check logs.

Notes

- Keep production secrets separate; add `SUPABASE_PROJECT_REF_PRODUCTION` later and use the same workflows with environment=production.
- Use the rollback runbook if a migration causes issues.
