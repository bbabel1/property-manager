# Repository Organization Review

## 1. Repo Overview

- **Frontend**: Next.js App Router (TypeScript, Tailwind), routes under `src/app` with client components in `src/components` and feature facades in `src/modules`.
- **Backend / APIs**: Next.js API routes in `src/app/api`, plus Supabase-based server logic and cron/scripts under `scripts/`.
- **Data Layer**: Supabase Postgres with generated types in `src/types/database.ts`; domain schemas live in `src/modules/*/schemas` and `src/schemas`.
- **Domain Areas**: Properties, units, owners, leases, banking, monthly logs, reconciliations, vendors, tenants, tasks, transactions.
- **Cross-Cutting**: Auth and middleware in `src/lib/auth` and `src/middleware.ts`; env validation in `src/env`; observability hooks via Sentry/OTel configs; shared UI primitives in `src/components/ui`.
- **Docs & Ops**: Extensive documentation in `docs/`; operational scripts in `scripts/` and database migrations in `supabase/`.

## 2. Directory & Module Map

Top-level (selected):

- `src/app` – App Router routes, API handlers, and demo pages.
- `src/components` – Shared and domain UI components (e.g., `monthly-logs`, `transactions`, `leases`).
- `src/modules` – Domain modules with services/schemas (`properties`, `leases`, `owners`, `banking`, `monthly-logs`).
- `src/lib` – Cross-cutting utilities (auth, constants, buildium integration helpers, metrics, state, enums).
- `src/server` – Server-only helpers for financials and monthly logs.
- `src/hooks`, `src/layout`, `src/ui` – Additional shared hooks/layout primitives.
- `docs`, `scripts`, `supabase`, `types` – Documentation, operational scripts, migrations, generated database types.

Issues noticed:

- Feature UI appears in both `src/components/<feature>` and `src/modules/<feature>`, making ownership ambiguous.
- Multiple generic buckets (`src/lib`, `src/components/common`, `src/components/ui`) blur separation between primitives and feature widgets.
- Domain logic is split between `src/modules`, `src/server`, and `src/components` without a clear layering contract.

## 3. Problems & Smells

### 3.1 Organization & Structure

- Monthly log UI lives in `src/components/monthly-logs` while services/schemas are in `src/modules/monthly-logs`, splitting the feature across folders and making discoverability harder.
- Transaction UI shells (e.g., `src/components/transactions/TransactionDetailShell.tsx`) sit outside a domain module, so related business logic/hooks are not co-located.
- `src/lib` holds many unrelated utilities (auth, constants, tasks, metrics, buildium helpers), acting as a catch-all rather than focused packages.

Impact: New developers must hunt across multiple directories per feature; unclear ownership slows refactors and increases coupling risk.

### 3.2 Naming & Conventions

- Mixed folder naming (both `units` and `unit`, `properties` vs `property`) leads to uneven imports.
- Some files use descriptive names while others are generic (e.g., `EnhancedHeader.tsx` without feature namespace), reducing clarity when imported elsewhere.

Impact: Inconsistent names make search/imports error-prone and obscure domain boundaries.

### 3.3 Separation of Concerns

- UI components fetch and mutate data directly (e.g., `StatementRecipientsManager` calls services and manages form validation and persistence in one component), blending presentation with side effects.
- Shared shells like `TransactionDetailShell` mix layout with action wiring hints; without domain-specific hooks, business rules risk leaking into UI.

Impact: Harder to test or reuse logic; UI changes risk breaking data flows.

### 3.4 Dead / Duplicate / Legacy Code

- Numerous docs and scripts exist, but test scripts are stubbed and some directories (e.g., `src/components/legacy`, `src/components/examples`) likely contain outdated or demo code that is not clearly marked.
- `package.json` test commands are placeholders, which can confuse contributors expecting runnable tests.

Impact: Noise increases onboarding time and undermines confidence in tooling.

### 3.5 Error Handling, Logging & Types

- Components often log warnings to console without structured logging (e.g., `console.warn` in `StatementRecipientsManager`), lacking consistent telemetry hooks.
- Env validation exists but is not referenced in documentation for runtime checks across API routes and server modules.

Impact: Production issues may be missed; inconsistent patterns reduce reliability.

### 3.6 Configuration & Secrets

- Env template is solid, but some optional observability variables are blank by default; routes/components may still assume presence of keys like Google Maps, increasing runtime failure risk if validation is bypassed.

Impact: Potential runtime errors when env validation isn’t executed before starting the app.

## 4. Proposed Folder Structure

Hybrid feature-first layout under `src/`:

```
src/
  app/                # App Router routes & API handlers
  features/
    properties/
    units/
    owners/
    leases/
    banking/
    monthly-logs/
    transactions/
      components/
      hooks/
      services/
      schemas/
  shared/
    components/       # Design system + cross-feature widgets
    hooks/            # Cross-feature hooks (SWR wrappers, auth)
    lib/              # Cross-cutting utilities (auth, logging, analytics)
    types/            # Shared TypeScript types
  config/             # Env parsing, runtime config helpers
  server/             # Server-only utilities (e.g., financial calculations)
```

- Move existing `src/modules/<domain>` into `src/features/<domain>` and co-locate UI currently in `src/components/<domain>`.
- Keep `shared/components/ui` for primitives; move domain-specific shells next to their feature.
- `config` centralizes env and runtime settings consumed by both server and client.

## 5. Cleanup & Refactor Tasks

### Task Set 0 – No-code prep

- [ ] Draft architecture/domain/dev-setup docs (`docs/architecture.md`, `docs/domain-model.md`, `docs/dev-setup.md`); link them from `README.md`.
- [ ] Inventory `src/components/legacy` and `src/components/examples`; mark deprecated/demo items in docs.

### Task Set 1 – Safe, non-behavioral changes

- [ ] Consolidate monthly log UI under `src/features/monthly-logs/components`; update imports via aliases/barrels.
- [ ] Consolidate transaction UI under `src/features/transactions/components`; update imports via aliases/barrels.
- [ ] Normalize folder naming for domains (e.g., `units/` vs `unit/`, `properties/` vs `property/`) and add `index.ts` barrels for stable imports.
- [ ] Introduce `src/config` that re-exports parsed env from `src/env`; migrate at least one low-risk consumer to prove the pattern.
- [ ] Clarify test status: annotate stubbed test scripts and update/add `tests/README.md` with current reality.
- [ ] Add lightweight logging helper in `shared/lib/logging.ts` and replace a few ad-hoc `console.warn` usages in high-traffic components.

### Task Set 2 – Medium-risk refactors

- [ ] Extract data fetching/mutation from UI into feature hooks/services (starting with `useStatementRecipients` for statement recipients UI) while keeping component props stable.
- [ ] Consolidate utilities in `src/lib` into cohesive packages (auth, buildium integration, tasks) with clear boundaries and barrel exports.
- [ ] Add feature-level `index.ts` exports for components/services to stabilize import paths before deeper moves across remaining domains.
- [ ] Evaluate legacy/demo components; either move to `shared/components/storybook`-style playground or remove if unused.

## 6. README & Docs Plan

### README

- Clarify current architecture, feature map, and how to run lint/typecheck.
- Document new folder structure and contribution guidelines.

### docs/architecture.md

- System diagram (app router → services → Supabase) and layering rules (feature modules vs shared vs config).
- Cross-cutting concerns: auth, logging/telemetry, env validation, error handling.

### docs/domain-model.md

- Entities: properties, units, owners, tenants, leases, transactions, monthly logs, banking accounts.
- Relationships and key workflows (lease lifecycle, statement generation, reconciliations).

### docs/dev-setup.md

- Setup steps, env table, supabase migration commands, lint/typecheck commands, seed data notes.
- How to run docs checks and any required tooling (e.g., `npm run ci:env-check`).

## 7. Ongoing Standards & Guardrails

- Enforce lint, format, and typecheck in CI; consider adding a minimal Playwright smoke test once scripts are restored.
- Adopt naming conventions: PascalCase for React components, kebab-case for files except components, camelCase for functions/variables, `useX` for hooks.
- Require features to live under `src/features/<domain>` with colocated components/hooks/services.
- Add a logging helper (wrapping pino or console) and prefer structured logs over ad-hoc warnings.
- Keep env parsing centralized; require `src/config` exports for any runtime configuration access.
