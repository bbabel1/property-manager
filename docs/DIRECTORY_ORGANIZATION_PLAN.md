# Directory & File Organization Plan

> Purpose: consolidate frontend/backend layout, reduce duplication, and make import paths consistent without breaking runtime behavior.

## Current Snapshot

- Top-level grouping is clear: `src/` (app, components, modules, lib, env, types), plus `docs/`, `scripts/`, `supabase/`, `tests/`, `styles/`, `public/`.
- Domain logic lives in `src/modules/{banking,leases,monthly-logs,owners,properties,staff,units}` but domain UI is still spread across `src/components/*` and several root-level `src/*.tsx` modals/autocompletes (e.g., `AddUnitModal.tsx`, `CreateOwnerModal.tsx`, `*AddressAutocomplete.tsx`).
- Shared utilities/hooks/types live under `src/{lib,hooks,schemas,types,server,env}`; design-system bits duplicated between `src/ui` and `src/components/ui`.
- `src/components` mixes domain-specific views (leases, monthly-logs, reconciliations, properties, transactions) with common widgets and UI primitives.
- Scripts are now bucketed: `scripts/diagnostics/`, `scripts/maintenance/`, `scripts/buildium/`, `scripts/migrations/`, `scripts/sql/`, `scripts/setup/`, `scripts/utils/`, `scripts/cron/`, `scripts/db/`, `scripts/database/`, `scripts/workflows/`.
- Docs stay under `docs/`; status/summaries live in `docs/reports/`. Stories at root. `tests/` currently only holds documentation (no active specs; package.json scripts are placeholders).
- Supabase: migrations/functions/config in `supabase/`; styles/assets in `styles/` and `public/`.

## Target Layout (end-state)

- `/docs`: keep architecture/feature/database docs; route status/test reports to `docs/reports/`; keep Storybook assets in `stories/` (or `docs/ui` if Storybook expects it).
- `/src/app`: Next.js routes and API handlers.
- `/src/modules/{domain}`: co-locate domain UI + server handlers + domain hooks + `services/` (+ `schemas/` where applicable) for properties, owners, leases, monthly-logs, banking, units, staff. Prefer module-level subfolders (e.g., `monthly-logs/components`, `monthly-logs/server`).
- `/src/components/ui`: reusable design-system primitives.
- `/src/components/common`: cross-domain widgets (tables, charts, filters, form helpers).
- `/src/lib`: shared utilities (Supabase clients, logging, telemetry, feature flags); `/src/hooks`: shared hooks; `/src/schemas`: Zod schemas/validators; `/src/types`: shared TS types (including Supabase-generated); `/src/server`: server-only helpers; `/src/env`: env validation.
- `/scripts`: maintain current buckets (`diagnostics/`, `maintenance/`, `buildium/`, `migrations/`, `sql/`, `setup/`, `utils/`, `database/`, `db/`, `cron/`, `workflows/`).
- `/tests`: add `tests/helpers/` for shared fixtures/mocks; keep e2e/unit/visual under `tests/{e2e,unit,visual}` when they exist; avoid leaving new reports at root.
- `/supabase`: migrations/config/functions; include README with usage pointers.
- `/public` and `/styles`: static assets and global styles.
- `/templates`: PDF/email templates (when added) with a short README.

## Sequenced Work Plan

1. **Docs and reporting**
   - ✅ Create `docs/reports/` and move root status/checklist markdowns there (e.g., `MIGRATION_READY_CHECKLIST.md`, `MONTHLY_LOG_*`, `typecheck-report.md`, `MCP_CLEANUP_SUMMARY.md`).
   - Add/align `supabase/README.md` to cover migrations/functions usage and link from `docs/README.md`.
   - Keep future legacy reports (API docs, test logs) out of root; place them in `docs/reports/`.
2. **Scripts cleanup**
   - ✅ Move root `scripts/check-*`, `verify-*`, `debug-*`, `fix-*`, `*performance*` into `scripts/diagnostics/` (or `scripts/maintenance/` when they mutate data).
   - ✅ Ensure `scripts/migrations/`, `scripts/sql/`, `scripts/setup/`, `scripts/buildium/` hold related helpers (e.g., `push-migration.ts`, `run-remote-sql.*`, `fetch-and-sync-buildium-bank-account.ts`).
   - Update any package.json/README references after moves.
3. **Domain consolidation**
   - Move domain components from `src/components/{leases,monthly-logs,management,properties,transactions,reconciliations,tenants,vendors,units}` into corresponding `src/modules/{domain}/components`.
   - ✅ Relocate root-level domain modals/autocompletes (e.g., `src/AddUnitModal.tsx`, `src/EditPropertyModal.tsx`, `src/CreateOwnerModal.tsx`, `src/*AddressAutocomplete.tsx`) out of `src/` (now in `src/components/legacy/` for safe keep). Next: fold into domain module components where appropriate and update imports.
   - Keep only design-system primitives in `src/components/ui`; move cross-domain helpers to `src/components/common`.
   - ✅ Add `services/` (and `schemas/` where present) READMEs inside each module for discoverability.
4. **Imports and aliases**
   - Use `rg -l "@/components"` and `rg -l "@/"` to find imports; update to module paths (e.g., `@/modules/properties/...`, `@/components/ui/...`, `@/components/common/...`).
   - If needed, add narrow path aliases (e.g., `@ui/*` -> `src/components/ui/*`) in `tsconfig.json` after moves.
5. **Tests and verification**
   - Add `tests/helpers/` for shared fixtures as they are discovered; relocate any stray test helpers from root. Remove placeholder package.json test scripts once real specs exist.
   - Run `npm run lint`, `npm run test` (or project equivalents) after each stage; fix import path regressions.

## Move Matrix (initial mapping)

- Domain UI: `src/components/monthly-logs/*` → `src/modules/monthly-logs/components/*`; same pattern for `leases`, `properties`, `transactions`, `reconciliations`, `units`, `management`, `tenants`, `vendors`.
- Duplicate modals/autocompletes: `src/*Modal.tsx`, `src/*Autocomplete.tsx` → corresponding `src/modules/{domain}/components/` (or `src/components/common/` if truly cross-domain).
- Shared UI: keep typography/buttons/etc. in `src/components/ui`; move tables/filters/charts shared across domains to `src/components/common`.
- Scripts: root `scripts/check-*.ts|js`, `verify-*`, `debug-*`, `fix-*`, `analyze-*` → `scripts/diagnostics/` (read-only) or `scripts/maintenance/` (mutating); `apply_sql.ts` + `run-remote-sql.*` → `scripts/sql/`.
- Docs: root status/summaries → `docs/reports/`; keep long-form guides in `docs/`.
- Stories: keep `stories/` for Storybook; optional future move to `docs/ui/` if Storybook build expects it.

## Notes / Risk Mitigation

- Perform moves in small batches and run typecheck/lint per batch to catch import regressions early.
- Avoid changing runtime logic; only update import paths for moved files.
- Watch for TS path aliases (`@/*`) and relative imports inside modules; prefer module-relative absolute paths post-move.
- Ensure Next.js route handlers/components under `src/app` stay in place.

## Definition of Done (per stage)

- No broken imports or lint errors after each batch.
- `src/components` limited to `ui/` + `common/` + true cross-domain pieces.
- Domain modules own their UI/server pieces.
- Scripts grouped by category with updated docs/references.
- Root clutter (status markdowns, stray helpers) relocated into dedicated folders.
