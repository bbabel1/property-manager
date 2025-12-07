# Ora Property Management

A modern property management platform built on Next.js 15, TypeScript, and Supabase—covering properties, owners, units, leases, banking, and monthly logs in one stack.

⚠️ **Auth Status**: Supabase Auth is the only auth system. NextAuth has been removed.

## Live Application
- https://pm.managedbyora.com – Production app, backed by Supabase (auth, Postgres, storage) and Buildium data sync; environment configured via the variables listed below.

## Project Overview & Value Proposition
- Unified operational suite: properties, owners, leases, banking, monthly statements.
- Supabase-first architecture: SSR-friendly auth, database types, RLS-ready.
- Opinionated monthly log workflow with PDF statements and multi-recipient delivery.

## Complete Tech Stack
- **Hosting & runtime:** Next.js 15 (App Router, SSR/ISR/edge support), React 18, TypeScript 5, `tsx` for TypeScript scripts; production URL served at `https://pm.managedbyora.com` on Vercel (Next.js-compatible host; infra/IaC lives under `infra/` if added).
- **External services:** Supabase (PostgreSQL, Auth, Storage) via `@supabase/supabase-js` and `@supabase/ssr`; Buildium API for property/accounting sync and webhooks; Sentry via `@sentry/nextjs` for errors/performance; Google Maps JS API for map components; Gmail OAuth + API via `googleapis`; Resend for statement email delivery; Ngrok for local webhook testing (see `docs/buildium-webhook-setup-guide.md`).
- **Data layer & infra libs:** `pg`/`@types/pg` for direct Postgres access; `dotenv` for env loading in scripts; Supabase migrations in `supabase/migrations/`; `sharp` for image/PDF asset handling; `pino` + `pino-pretty` for structured logging.
- **Observability & tracing:** OpenTelemetry stack (`@opentelemetry/sdk-node`, `resources`, `semantic-conventions`, `exporter-trace-otlp-http`, `instrumentation-{fetch,http,pg,pino}`) feeding traces to your collector; app-level instrumentation lives in `instrumentation.ts`.
- **Alerting & incident routing:** PagerDuty Events v2 integration wired via `LOG_FORWARDER_URL` and `PAGERDUTY_ROUTING_KEY` (see `src/lib/pagerduty.ts` and Supabase edge function helpers under `supabase/functions/_shared/pagerDuty.ts`).
- **Data fetching & state:** `swr` for client caching; `zustand` for lightweight client state stores.
- **Forms & validation:** `react-hook-form`, `@hookform/resolvers`, and `zod` for typed schemas and validation.
- **Styling & theming:** Tailwind CSS v4 with plugins (`@tailwindcss/forms`, `@tailwindcss/typography`, `@tailwindcss/container-queries`, `@tailwindcss/postcss`), utility helpers (`tailwind-merge`, `class-variance-authority`, `clsx`), and `next-themes` for theme toggling.
- **UI components & interactions:** Radix UI suite (`@radix-ui/react-*` accordion/alert-dialog/dialog/dropdown/tabs/tooltip/etc.), `@headlessui/react` primitives, `cmdk` command palette, `lucide-react` icons, `sonner` toasts, drag-and-drop via `@dnd-kit/{core,sortable,modifiers}`, `react-resizable-panels` for layout resizing, `vaul` sheets/drawers, `embla-carousel-react` sliders, `recharts` charts, `react-day-picker`, and `input-otp`.
- **Utilities:** `date-fns` for date/time handling and formatting.
- **Testing, linting & formatting:** `playwright` for end-to-end coverage (currently stubbed), `eslint` + `eslint-config-next` + `@eslint/eslintrc`, `stylelint` + `stylelint-config-standard` + `stylelint-config-tailwindcss`, `prettier` + `prettier-plugin-tailwindcss`, `markdownlint` + `markdownlint-cli`, and `typescript` for strict type checks (including env validation via `npm run ci:env-check` with Zod).
- **Developer workflow:** `husky` + `lint-staged` for git hook enforcement, `concurrently` for multi-process dev tasks, type definitions via `@types/{node,react,react-dom}`, and Supabase CLI usage (`npx supabase@latest`) embedded in package scripts for schema dumps and type generation.
- **Application structure:** Domain modules sit under `src/modules/<domain>/` (services, schemas, UI entrypoints); shared primitives in `src/components/`, cross-cutting infra in `src/lib/`, routes/API handlers in `src/app/`, and environment validation in `src/env/`.

## Routes & Feature Map
- **Pages**
  - `/` – Marketing/entry splash.
  - `/(protected)/dashboard` – Org-level overview cards and metrics.
  - `/(protected)/properties`, `/(protected)/owners`, `/(protected)/units`, `/(protected)/tenants` – Core portfolio management lists and detail pages.
  - `/(protected)/leases` – Lease workflows and contacts.
  - `/(protected)/bank-accounts`, `/(protected)/reconciliations` – Banking, imports, and reconciliation flows.
  - `/(protected)/monthly-logs` – Monthly log review, statements, and recurring tasks.
  - `/(protected)/files` – File library, uploads, and entity attachments.
  - `/(protected)/maintenance` & `/(protected)/tasks` – Work orders and task queues.
  - `/(protected)/settings` – Organization and profile settings.

- **API endpoints (selected)**
  - Health/metrics: `/api/health`, `/api/metrics`, `/api/metrics/rum`.
  - Core CRUD: `/api/properties`, `/api/owners`, `/api/units`, `/api/leases`, `/api/tenants`, `/api/vendors`, `/api/bills`, `/api/bank-accounts`.
  - Files: `/api/files/*` for listing, upload, categories, and attachments.
  - Monthly logs & accounting: `/api/monthly-logs/*`, `/api/journal-entries/*`, `/api/reconciliations/*`.
  - Buildium integration: `/api/buildium/*` (accounting lock periods, properties, leases, bank accounts, tasks, sync, etc.).
  - Admin/operations: `/api/admin/*`, `/api/debug/*`, `/api/work-orders/*`, `/api/webhooks/*`.

## Architecture & Domain References
- [Architecture guide](docs/architecture.md) – Layering, data flow, and integration patterns.
- [Domain model](docs/domain-model.md) – Key entities, relationships, and module boundaries.
- [Performance strategy](docs/performance-strategy.md) – Rendering budget, data-fetching choices, and caching approaches.

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
- Full index: [`docs/README.md`](docs/README.md) lists every file under `docs/`.
- Overview docs: [`architecture.md`](docs/architecture.md), [`domain-model.md`](docs/domain-model.md), [`performance-strategy.md`](docs/performance-strategy.md), [`features.md`](docs/features.md), [`decisions.md`](docs/decisions.md).
- Category directories: [`architecture/`](docs/architecture/), [`api/`](docs/api/), [`database/`](docs/database/), [`design-system/`](docs/design-system/), [`observability/`](docs/observability/), [`security/`](docs/security/), [`runbooks/`](docs/runbooks/), [`reports/`](docs/reports/), [`ai-analysis/`](docs/ai-analysis/), [`ui-components/`](docs/ui-components/).
- Additional top-level guides: onboarding and operational notes such as [`QUICK_START_GUIDE.md`](docs/QUICK_START_GUIDE.md), Buildium guides (e.g., [`buildium-integration-guide.md`](docs/buildium-integration-guide.md)), monthly log references (e.g., [`MONTHLY_LOG_README.md`](docs/MONTHLY_LOG_README.md)), and safety/process docs (e.g., [`DATABASE_SAFETY_GUIDE.md`](docs/DATABASE_SAFETY_GUIDE.md)).
