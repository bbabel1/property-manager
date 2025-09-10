Deploy Runbook

Scope
- App: Next.js (App Router) + TypeScript
- Backend: Supabase (PostgreSQL, Edge Functions)
- Observability: Sentry (errors), OpenTelemetry (traces, optional)

Prerequisites
- CI is green (lint, typecheck, tests)
- Required env vars configured in target env:
  - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
  - SENTRY_DSN (+ sampling vars, optional)
  - OTEL_EXPORTER_OTLP_ENDPOINT (+ headers), optional
  - BUILDIUM_* secrets (if Buildium integration enabled)
- Database migration plan reviewed and reversible strategy agreed (see rollback runbook)

1) Pre‑deploy Checklist (10–15 min)
- Confirm release commit/tag and changelog
- Review migrations under `supabase/migrations/`
- Backups:
  - If Supabase PITR is enabled: note restore point (timestamp now)
  - Else: create a schema dump
    - Option A: Dashboard SQL export
    - Option B: CLI: `npx supabase@latest db dump --local --file docs/database/current_schema.sql`
- Verify secrets in target env (app + edge functions)
- Set/confirm Sentry sampling: `SENTRY_TRACES_SAMPLE_RATE`
- If using OTel, ensure collector reachable from runtime

2) Database Migrations (Supabase)
- Option A – Dashboard: Apply SQL files in chronological order
- Option B – CLI (recommended from a clean working tree):
  - `supabase link --project-ref <your-ref>`
  - `supabase db push` (applies unapplied migrations)
- After applying:
  - Regenerate types locally (optional): `npm run db:types`
  - Sanity check: run a simple query in SQL editor: `select now();`

3) Deploy Edge Functions (if updated)
- List functions: `ls supabase/functions`
- Deploy all changed functions:
  - `supabase functions deploy <name> --project-ref <your-ref>`
- Quick smoke test (if function supports it):
  - `supabase functions invoke <name> --project-ref <your-ref> --no-verify-jwt --data '{"ping":true}'`

4) Deploy Application
- Vercel (example):
  - Ensure env vars set in Vercel project
  - Trigger build from main branch or `vercel deploy --prebuilt`
  - Optionally promote preview to production
- Other hosting:
  - Build: `npm run build`
  - Start: `npm run start` (ensure process manager / container rollout strategy)

5) Post‑deploy Validation (10–15 min)
- App smoke tests:
  - Visit homepage and `/dashboard` redirects
  - Hit a simple API: `curl -s -o /dev/null -w "%{http_code}\n" <APP_URL>/api/buildium/properties | grep 200`
- DB health:
  - Supabase SQL editor: `select now();`
  - Optionally run a lightweight count: `select count(*) from properties;`
- Observability:
  - Sentry: confirm no spike in error rate; new release appears
  - OpenTelemetry: traces visible for a test request
- Webhooks / Edge:
  - Trigger a minimal webhook or test event and confirm processing logs

6) Rollout Guardrails
- Keep previous deployment warm for fast rollback (see rollback runbook)
- Monitor for 30–60 minutes; if error rate > threshold or key KPIs regress, consider rollback

Appendix: Useful Commands
- HTTP smoke: `curl -s -o /dev/null -w "%{http_code} %{time_total}\n" <APP_URL>/api/health`
- Supabase link: `supabase link --project-ref <ref>`
- Functions deploy: `supabase functions deploy <name> --project-ref <ref>`

