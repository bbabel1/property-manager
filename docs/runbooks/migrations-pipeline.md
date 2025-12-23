Migrations Pipeline

Overview

- GitHub Actions workflow `.github/workflows/migrations.yml` applies Supabase SQL migrations after CI succeeds or on manual trigger.
- Targets `staging` by default; can target `production` via manual dispatch and environment protection.

Secrets to Configure (GitHub → Settings → Secrets and variables → Actions)

- `SUPABASE_ACCESS_TOKEN` – Personal access token for Supabase CLI.
- `SUPABASE_PROJECT_REF_STAGING` – Project ref for staging Supabase project.
- `SUPABASE_PROJECT_REF_PRODUCTION` – Project ref for production Supabase project.

How It Runs

1. Auto: After `CI` workflow completes successfully on `main`, migrations run against `staging` (environment rules apply).
2. Manual: Trigger from Actions → Database Migrations → Run workflow; choose `staging` or `production`.

Protections

- The job uses GitHub Environments. Add required reviewers on `production` to gate migration runs.
- Concurrency prevents overlapping runs per branch/environment.

Local Equivalent

- Link and push:
  ```bash
  supabase link --project-ref $SUPABASE_PROJECT_REF
  supabase db push
  ```

Notes

- Ensure migrations in `supabase/migrations/` are ordered and idempotent where possible.
- Prefer corrective forward migrations over destructive rollbacks (see rollback runbook).

## Transaction Totals Architecture

**Important**: Transaction totals (`transactions.total_amount`) are now derived from signed transaction lines via `fn_calculate_transaction_total()`. Legacy triggers that enforced totals via simple sum of lines have been removed.

### How It Works

- Transaction totals are calculated using the signed calculator function `fn_calculate_transaction_total()`
- The function applies proper Debit/Credit accounting: `Debit` lines add to total, `Credit` lines subtract
- All amounts are stored as absolute values with sign carried by `posting_type` (normalized to 'Debit'/'Credit')
- Totals are automatically maintained via triggers on `transaction_lines` changes

### Migrations Applied

- `20251230120000_normalize_posting_type.sql`: Normalized posting types and enforced absolute amounts
- `20251230123000_drop_legacy_total_triggers.sql`: Removed legacy sum-of-lines triggers, unified to signed calculator

### Legacy Triggers Removed

- `trg_transaction_total_matches` (on `transactions`)
- `trg_transaction_total_lines_insupd` (on `transaction_lines`)
- `fn_transaction_total_matches_on_lines()`
- `fn_transaction_total_matches()`

All transaction total calculations now flow through `fn_calculate_transaction_total()` for consistency.
