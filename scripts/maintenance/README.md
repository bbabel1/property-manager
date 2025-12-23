# Maintenance Scripts

> **Purpose**: Database maintenance, cleanup, and optimization scripts

## Overview

This directory contains mutating scripts: data fixes, seeds, and one-off sync helpers. Typical categories:

- **Fixes**: `fix-*` scripts for monthly logs, ownership totals, Supabase import issues, route handler adjustments, etc.
- **Create/Sync**: `create-*`, `import-buildium.ts`, `manual-lease-sync.ts`, `map-buildium-rent-id.ts` for targeted data creation or reconciliation.
- **Seeds/Resets**: `seed.ts`, `seed_gl_settings.ts`, `seed_org.ts`, `reset-db.ts`.
- **Utilities**: `refresh-schema-cache.ts` and similar helper tasks.

## Usage

```bash
# Example: run a data fix
npx tsx scripts/maintenance/fix-monthly-log-schema.ts

# Example: reseed org data
npx tsx scripts/maintenance/seed_org.ts
```

## Maintenance Schedule

No fixed cadence; run scripts as needed for repairs, seeding, or data reconciliation.

## Notes

- **Backup first**: many scripts mutate production data; capture a backup or run against a clone before applying broadly.
- **Check environment**: ensure `.env` is populated (Supabase keys, DSNs) and you are pointing at the correct project.
- **Validate**: rerun diagnostics after fixes (see `scripts/diagnostics/`) to confirm expected outcomes.
