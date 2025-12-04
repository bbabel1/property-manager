# Ora Property Management

A modern property management platform built on Next.js 15, TypeScript, and Supabase—covering properties, owners, units, leases, banking, and monthly logs in one stack.

⚠️ **Auth Status**: Supabase Auth is the only auth system. NextAuth has been removed.

## Project Overview & Value Proposition
- Unified operational suite: properties, owners, leases, banking, monthly statements.
- Supabase-first architecture: SSR-friendly auth, database types, RLS-ready.
- Opinionated monthly log workflow with PDF statements and multi-recipient delivery.

## Tech Stack & Architecture Snapshot
- Next.js App Router, TypeScript (strict), SWR for data fetching, React Hook Form + Zod for forms.
- Supabase (PostgreSQL, RLS), Buildium integration, Sentry/OTel optional observability.
- Domain modules live in `src/modules/<domain>/` with services, schemas, and UI entrypoints.

## Quick Start
1) Install: `npm install`  
2) Env: `cp env.example .env.local` then fill values (see table below).  
3) Database: apply SQL in `supabase/migrations/` (CLI or dashboard). See `docs/database/SUPABASE_SETUP.md`.  
4) Run dev server: `npm run dev` → http://localhost:3000  

## Running & Tooling
- `npm run dev` – Next.js dev server
- `npm run lint` – ESLint (TS + Next rules)
- `npm run typecheck` – Strict TS project check
- `npm run format` / `npm run format:check` – Prettier
- `npm run ci:env-check` – Validates env with zod
- Tests: Playwright/Vitest currently stubbed; see `tests/README.md` for expectations when re-enabled.

## Environment Variables (summary)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side Supabase operations |
| `BUILDIUM_BASE_URL`, `BUILDIUM_CLIENT_ID`, `BUILDIUM_CLIENT_SECRET`, `BUILDIUM_WEBHOOK_SECRET` | Yes (Buildium) | Buildium API + webhook |
| `NEXT_PUBLIC_APP_URL` | Yes | Base app URL |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Maps components (client zod requires it) |
| `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | Optional | Statement email delivery |
| `COMPANY_*`, `COMPANY_LOGO_URL` | Optional | Branding for PDFs |

See `ENVIRONMENT_SETUP.md` and `env.example` for full notes.

## Directory Structure (high level)

```text
src/
├─ app/                  # App Router routes & API handlers
├─ components/           # Shared UI + domain UI
├─ modules/              # Domain modules (services/schemas/components facades)
├─ lib/                  # Cross-domain services (auth, permissions, infra)
├─ env/                  # zod env validation
├─ types/                # Generated DB types
docs/                    # Product + architecture docs
scripts/                 # Operational/maintenance scripts
supabase/                # Migrations, config, CLI helpers
tests/                   # Test docs/config (see tests/README.md)
```

## Major Features (with entrypoints)
- Properties/Owners/Units: `src/app/(protected)/properties/*`, services in `src/modules/properties`
- Leases: lease services in `src/modules/leases`
- Banking: account services in `src/modules/banking`
- Monthly Logs: UI in `src/components/monthly-logs`, services/schemas in `src/modules/monthly-logs`
- Buildium Integration: scripts under `scripts/buildium/*`
- Auth: Supabase middleware/providers, see `docs/architecture.md`

## Testing Strategy
- Lint + typecheck on every change (`npm run lint`, `npm run typecheck`).
- Playwright/Vitest hooks are stubbed; re-enable as needed (see `tests/README.md`).
- Env validation gate via `npm run ci:env-check`.

## Deployment Notes
- Supabase: run migrations before deploy; refresh generated types (`npm run types:remote`).
- Next.js hosting: set env vars per environment; ensure `NEXT_PUBLIC_APP_URL` matches domain.
- Monitoring: Sentry/OTel optional—leave DSN empty to disable.

## Contribution & Coding Standards
- Formatting: Prettier + Tailwind plugin; lint-staged enforces on commit.
- Code style: PascalCase components, camelCase functions, path aliases via `@/`.
- Keep domain logic in `src/modules/<domain>/services` and validation in `src/modules/<domain>/schemas`.
- Security: No secrets in code; use env files and provider secrets.

## Troubleshooting / FAQ
- Env validation fails: ensure all required keys are set; Maps key must be non-empty.
- Supabase errors locally: confirm service role key and project URL match your local CLI link.
- Styling issues: run `npm run format` to apply Prettier/Tailwind sorting.

## Documentation Index
- Full docs live in `docs/` (see `docs/README.md`), plus new summaries:
  - `docs/architecture.md` – Layering, data flow, domain modules
  - `docs/features.md` – Feature map → routes/modules
  - `docs/decisions.md` – Key architecture decisions (Supabase auth, SWR, styling, telemetry)
