Secrets Management Strategy

Goals

- Keep secrets out of the repo and images; load via provider secret stores.
- Separate configs per environment (local, CI, staging, production).
- Make rotation easy and safe.

Environments & Stores

- Local development: `.env.local` only (never committed). Optionally use a vault (1Password/Doppler) to fetch into your shell.
- CI/CD (GitHub Actions): repository or environment Secrets.
- App hosting (e.g., Vercel/Render/Fly/AWS): provider environment variables/secrets.
- Supabase Edge Functions: Supabase Secrets (per project), read via `Deno.env`.

Secret Inventory (by scope)

- App (server/runtime):
  - `SUPABASE_SERVICE_ROLE_KEY` (server only)
  - `BUILDIUM_CLIENT_ID`, `BUILDIUM_CLIENT_SECRET`, `BUILDIUM_WEBHOOK_SECRET` (optional - used as fallback when no org-scoped credentials in DB)
  - `GMAIL_TOKEN_ENCRYPTION_KEY` or `NEXTAUTH_SECRET` (used for encrypting Buildium credentials and OAuth tokens)
  - `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`
  - `EMAIL_SERVER_*` (if used)
- Database-stored (encrypted):
  - Buildium credentials per organization (stored in `buildium_integrations` table)
  - Encrypted using `GMAIL_TOKEN_ENCRYPTION_KEY` or `NEXTAUTH_SECRET`
  - Encryption key source: `GMAIL_TOKEN_ENCRYPTION_KEY` environment variable, falling back to `NEXTAUTH_SECRET`
- Public runtime (safe to expose to browser):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_*`
- CI/CD (GitHub Actions):
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_REF_STAGING` / `SUPABASE_PROJECT_REF_PRODUCTION`

GitHub Actions (CI/CD)

1. Go to Repository → Settings → Secrets and variables → Actions.
2. Add repository secrets:
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_PROJECT_REF_STAGING`
   - `SUPABASE_PROJECT_REF_PRODUCTION`
3. Create Environments `staging` and `production` and add required reviewers for `production`.

Supabase Edge Function Secrets

- Set project secrets used by Edge Functions (e.g. Buildium keys):
  ```bash
  supabase link --project-ref <PROJECT_REF>
  supabase secrets set \
    BUILDIUM_CLIENT_ID=... \
    BUILDIUM_CLIENT_SECRET=... \
    BUILDIUM_WEBHOOK_SECRET=... \
    SUPABASE_SERVICE_ROLE_KEY=... \
    SUPABASE_URL=https://<PROJECT_REF>.supabase.co
  ```
- Deploy functions normally: `supabase functions deploy <name>`

App Hosting (Example: Vercel)

- Project Settings → Environment Variables per environment (Preview/Production):
  - Add all server-only and public variables listed above.
  - Avoid setting `SUPABASE_SERVICE_ROLE_KEY` on the client (it must only be available on server/edge runtime).

Local Development

- Use `.env.local` (gitignored) to store local values.
- Keep `env.example` updated for onboarding.

Rotation Playbook

1. Generate new secret in the upstream provider (e.g., Supabase service role rotate in Dashboard).
2. Update values in:
   - Hosting provider env vars
   - GitHub Actions Secrets (if used by pipelines)
   - Supabase Secrets (for Edge Functions)
   - `.env.local` for local dev
3. Redeploy app and functions.
4. Invalidate/disable old secret.

Buildium Credential Rotation

- **UI-based rotation**: Update credentials via Settings → Integrations (org) → Buildium → Manage
- **Encryption key rotation**: If `GMAIL_TOKEN_ENCRYPTION_KEY` or `NEXTAUTH_SECRET` changes:
  - Existing encrypted credentials in database become invalid
  - Users must re-enter credentials through the UI
  - Old encrypted credentials cannot be decrypted with new key
  - Plan: Rotate encryption key during maintenance window, notify users to re-enter credentials

Hardening & Hygiene

- Remove committed secrets: ensure `.env` files are not tracked. If any were committed, rotate immediately and purge from history (e.g., `git filter-repo` or BFG).
- Add environment protections (required reviewers) for production migrations/deploys.
- Audit: run dependency scans and secret scans in CI.
