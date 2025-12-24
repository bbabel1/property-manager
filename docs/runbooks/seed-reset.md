Seed and Reset Data

<!-- markdownlint-configure-file {"MD013": false, "MD029": false, "MD031": false} -->

Overview

- `scripts/seed.ts`: inserts best‑effort demo data (contacts → owners → a sample property).
- `scripts/reset-db.ts`: deletes data from common tables in dependency order.

Safety

- Both scripts use the Supabase service role key; treat carefully.
- Seed: refuses to run in `NODE_ENV=production` unless `ALLOW_SEED_PROD=1` and `REQUIRE_CONFIRM=YES`.
- Reset: requires `RESET_CONFIRM=YES` or `--force`. Refuses to run in production unless forced.

Usage

- Seed (local):
  ```bash
  npm run db:seed
  ```
- Reset (local):
  ```bash
  npm run db:reset
  ```
- Reset (custom tables):
  ```bash
  RESET_CONFIRM=YES npx tsx scripts/reset-db.ts --tables owners,properties,contacts
  ```

Configure

- Ensure env vars are set for admin client:
  - `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`)
  - `SUPABASE_SERVICE_ROLE_KEY`

Notes

- The property seed uses a generic `country` value; if your schema enforces an enum, adjust as needed.
- Extend the scripts with additional inserts or delete orders as your schema evolves.
