# Migration Standards

These rules keep migrations safe across environments and stop the “final fix” pileups that were using far‑future timestamps.

## Naming and ordering
- Use `YYYYMMDDHHMMSS_description.sql` (14‑digit UTC timestamp, ASCII slug).
- Do not mint timestamps more than three years in the future; CI will fail them.
- Legacy 2029 placeholders were renumbered into 2027 (`20270131151000_normalize_migration_versions.sql` maps existing environments).

## Zero-downtime patterns
- Add columns as nullable, backfill in a separate step, then enforce `NOT NULL`.
- Create indexes `CONCURRENTLY` on large tables (transactions, transaction_lines, bank_register_transactions, reconciliation_log, payment_* tables, etc.).
- Avoid destructive `DROP` operations; use expand/contract with a backfill and deploy guardrails before removal.

## Migration linter (CI-enforced)
- Run `npm run lint:migrations` before opening a PR; CI runs the same check.
- File checks: valid timestamp prefix, no duplicate timestamps, and no far‑future clocks.
- DDL checks apply to new migrations (timestamps ≥ `20270201030000`):
  - `CREATE INDEX` on large tables must use `CONCURRENTLY` or opt out.
  - `ALTER TABLE ... ADD/SET NOT NULL` requires a staged pattern or opt out.
  - `DROP TABLE/COLUMN/SCHEMA` requires an explicit opt out.

### Opt-out annotations (use sparingly)
- `-- lint:allow-nonconcurrent` to skip the concurrent index requirement.
- `-- lint:allow-not-null` to acknowledge an intentional NOT NULL change.
- `-- lint:allow-drop` for intentional destructive drops when expand/contract is not possible.

## Reset and drift safety
- `supabase db reset` applies the normalized sequence deterministically.
- `supabase_migrations.schema_migrations` entries are remapped by `20270131151000_normalize_migration_versions.sql` to keep staging/production aligned after the renumbering.
