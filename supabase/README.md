# Supabase Guide

This folder contains Supabase config, migrations, and helpers.

## Migrations Workflow

- **Apply (linked project)**: `npx supabase db push --linked`
- **Diff remote**: `npx supabase db diff --linked --schema public`
- **Reset (linked)**: `npx supabase db reset --linked` (dangerous; confirm target)
- **Local dev**: `npx supabase start` to run local stack, then `npx supabase db reset --local`

See `supabase/migrations/` for ordered SQL files. Apply in order if running manually in the dashboard.

### Migration hygiene

- Filenames must be `YYYYMMDDHHMMSS_description.sql` (14-digit UTC timestamp).
- Far-future placeholders were renumbered into 2027; `20270131151000_normalize_migration_versions.sql` keeps existing envs in sync.
- Run `npm run lint:migrations` before pushing; CI fails on unsafe DDL for new migrations.
- Zero-downtime defaults: add nullable → backfill → enforce; create indexes concurrently on large tables; use expand/contract for drops.
- Opt-outs (use sparingly): `-- lint:allow-nonconcurrent`, `-- lint:allow-not-null`, `-- lint:allow-drop`.

## Types & Schema Docs

- Generate local types: `npm run types:local` → `src/types/database.ts`
- Generate remote types: `npm run types:remote`
- Update schema doc: `npm run db:schema` (writes `docs/database/current_schema.sql`)
- Dump linked remote schema snapshot: `npm run db:schema:linked` (writes `supabase/schema.sql`, also captured as a CI artifact)

## Environment

Ensure these are set when using CLI:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

For linked environments, Supabase CLI will also read `.env.local` if present.

## Tests & Seeds

- Seeds: `supabase/seed.sql` is loaded on reset when enabled.
- Supabase tests (if any) live under `supabase/tests/`.

## Troubleshooting

- CLI auth issues: run `npx supabase login` and verify project ref.
- Migrations failing: check for breaking changes vs remote schema (`db diff`).
- Types out of date: re-run `npm run types:local` after schema changes.

- **Array columns**: Use proper array syntax for `rental_owner_ids`

- **Timestamps**: All timestamps are in UTC with timezone information

### Support

For migration issues, check:

1. Supabase dashboard logs
2. Database connection settings
3. SQL syntax validation
4. Constraint violations in data
