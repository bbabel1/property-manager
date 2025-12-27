# Architecture Overview

<!-- markdownlint-configure-file {"MD013": false} -->

This app is organized around clear layers and domain modules to keep UI, data access, and validation predictable.

## Layers

- **UI (App Router)**: Routes and layouts in `src/app`, domain UI in `src/components` and `src/modules/<domain>/components`.
- **API / Server Actions**: Route handlers in `src/app/api/*` (and server actions where used). These should call domain services instead of inline Supabase queries.
- **Domain Services**: `src/modules/<domain>/services` centralize Supabase access, calculations, and validations for each core domain.
- **Schemas & Validation**: `src/modules/<domain>/schemas` use Zod for request/response validation; shared env schemas live in `src/env`.
- **Cross-Cutting**: Auth/permissions in `src/lib/auth` and `src/lib/permissions`; logging/metrics in `src/lib/monitoring` and `src/lib/metrics`.

## Data Flow

1. UI triggers action (form submit, button) in `src/app` or a domain component.
2. API route/server action calls a domain service under `src/modules/<domain>/services`.
3. Domain service validates input with Zod schemas and queries Supabase.
4. Responses are normalized and passed back to the UI via SWR/fetch.

## Domain Modules

- `src/modules/properties`: property/owner/unit relationships, summaries, and UI entrypoints.
- `src/modules/owners`: owner-facing helpers (currently via property services).
- `src/modules/units`: unit detail and status services.
- `src/modules/leases`: lease calculations and transaction helpers.
- `src/modules/banking`: bank account services and GL alignment helpers.
- `src/modules/monthly-logs`: monthly log services, schemas, and UI exports.
- `src/modules/staff`: staff role normalization and helpers.

## Auth & Permissions

- Auth: Supabase Auth with SSR helpers.
- Permissions: centralize checks in `src/lib/permissions` and `src/lib/rbac`. Avoid duplicating role checks in components.

## Observability

- Sentry (optional) + OpenTelemetry helpers in `src/lib/metrics` and `instrumentation.ts`. Disable by leaving DSNs empty.

## Legacy/Examples

- `src/components/legacy`: pre-architecture components kept for reference only; not wired into current modules. Do not import; port patterns into current domain components instead.
- `src/components/examples`: demo-only `SectionDetail` usage; avoid shipping/importing and build new UI from the shared components.
- `src/app/ui-components-demo`: route that renders the examples above for manual viewing; keep out of navigation and remove before production deploys.

## Testing status

- Automated test scripts (`npm run test`, `test:unit`, `test:a11y`, `test:visual`) are stubbed to echo “removed”, so there is effectively 0% automated unit/e2e/a11y/visual coverage.
- CI runs lint and Stylelint; type checking is non-blocking (`continue-on-error: true`), and the Playwright install step runs without any specs, so regression risk is currently unmanaged by tests.
- All feature areas (e.g., monthly log flows, Buildium webhook handling) rely on manual QA; prioritize rebuilding a minimal unit suite and high-value Playwright smoke paths before shipping major changes.
