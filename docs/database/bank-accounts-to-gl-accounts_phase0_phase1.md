# Bank Accounts → `gl_accounts` Migration (Phase 0 + Phase 1)

<!-- markdownlint-configure-file {"MD013": false} -->

This document captures the Phase 0 inventory and Phase 1 schema changes for migrating away from the `public.bank_accounts` table to using `public.gl_accounts` as the single source of truth for bank accounts (`gl_accounts.is_bank_account = true`).

## Decision (Chosen Strategy)

We are using **option (b)**:

- Add new `*_bank_gl_account_id` foreign keys (pointing to `gl_accounts.id`)
- Backfill them safely
- Cut over reads/writes and Buildium syncs incrementally
- Drop the old `bank_accounts` table after validation

Rationale: this allows dual-read/dual-write during rollout and minimizes risk to Buildium syncs.

## Current Inventory (Key Touchpoints)

### UI

- Bank account dropdown currently loads from `GET /api/bank-accounts`:
  - `src/components/BankingDetailsModal.tsx`
  - `src/components/legacy/BankingDetailsModal.tsx`

### Next.js API routes

- Bank accounts CRUD/sync:
  - `src/app/api/bank-accounts/route.ts`
  - `src/app/api/bank-accounts/[id]/route.ts`
  - `src/app/api/bank-accounts/sync/from-buildium/route.ts`
- Property details and property sync use `bank_accounts`:
  - `src/app/api/properties/[id]/details/route.ts`
  - `src/app/api/properties/[id]/sync/route.ts`
  - `src/app/api/properties/route.ts`
- Reconciliations and bills reference `bank_accounts`:
  - `src/app/api/buildium/bank-accounts/reconciliations/route.ts`
  - `src/app/api/admin/sync/reconciliations/route.ts`

### Supabase Edge Functions

- Buildium “syncFromBuildium” bank-account upsert uses `bank_accounts`:
  - `supabase/functions/buildium-sync/index.ts`
- Buildium webhooks resolve property operating bank account via `bank_accounts`:
  - `supabase/functions/buildium-webhook/index.ts`

### Library code

- Buildium mapping helper creates/reads `bank_accounts`:
  - `src/lib/buildium-mappers.ts` (`resolveBankAccountId`)
- Generic Buildium sync service maps `bank_account` → `bank_accounts`:
  - `src/lib/buildium-sync.ts`
- Various services/selects:
  - `src/lib/bank-account-service.ts`
  - `src/lib/property-service.ts`
  - `src/lib/lease-transaction-helpers.ts`
  - `src/lib/email-templates/variable-mapping.ts`

### Scripts

- Several scripts read/write `bank_accounts`, including Buildium sync utilities:
  - `scripts/buildium/sync/*`
  - `scripts/maintenance/*`
  - `scripts/diagnostics/*`

## Phase 1: Schema Additions to `gl_accounts`

Phase 1 adds bank-account-specific fields to `public.gl_accounts` so all Buildium and UI “bank account” details can be sourced from:

- `public.gl_accounts` filtered by `is_bank_account = true`

### Column Mapping (Old → New)

When we later backfill (Phase 2), the mapping will be:

- `bank_accounts.buildium_bank_id` → `gl_accounts.buildium_gl_account_id`
- `bank_accounts.bank_account_type` → `gl_accounts.bank_account_type`
- `bank_accounts.account_number` → `gl_accounts.bank_account_number`
- `bank_accounts.routing_number` → `gl_accounts.bank_routing_number`
- `bank_accounts.country` → `gl_accounts.bank_country`
- `bank_accounts.check_printing_info` → `gl_accounts.bank_check_printing_info`
- `bank_accounts.electronic_payments` → `gl_accounts.bank_electronic_payments`
- `bank_accounts.balance` → `gl_accounts.bank_balance`
- `bank_accounts.buildium_balance` → `gl_accounts.bank_buildium_balance`
- `bank_accounts.last_source` → `gl_accounts.bank_last_source`
- `bank_accounts.last_source_ts` → `gl_accounts.bank_last_source_ts`

Notes:

- `gl_accounts.name` remains the display name for the dropdown and Buildium payload.
- `gl_accounts.description` remains the description for the dropdown/payload (no separate bank-specific description is introduced in Phase 1).

## RLS / Exposure Notes

- `gl_accounts` and `bank_accounts` both use org-membership-based RLS for row access, so adding bank fields to `gl_accounts` does not expand row visibility beyond what `bank_accounts` already allowed.
- To avoid unintentionally returning sensitive bank fields through existing API responses, `src/app/api/gl-accounts/[id]/route.ts` is constrained to a safe column list (no `bank_account_number` / `bank_routing_number`).

## Phase 2: New FK Columns + Backfill

Phase 2 introduces new foreign keys that point directly to `gl_accounts.id` for bank account selection:

- `properties.operating_bank_gl_account_id`
- `properties.deposit_trust_gl_account_id`
- `transactions.bank_gl_account_id`
- `reconciliation_log.bank_gl_account_id`

Backfill logic:

- Populate new FK columns by joining existing `*_bank_account_id` → `bank_accounts.id` → `bank_accounts.gl_account`.
- Copy bank account fields onto `gl_accounts` and set `gl_accounts.is_bank_account = true`.
  - When multiple `bank_accounts` share the same `gl_account`, the backfill chooses the most recently updated record; Phase 2 also provides a script to split duplicates cleanly.

## Phase 3: UI/API Cutover (Dropdowns)

- New endpoint for bank-account dropdowns: `GET /api/gl-accounts/bank-accounts`
  - Sources from `gl_accounts` filtered by `is_bank_account = true`
  - Returns masked account numbers
- New create path: `POST /api/gl-accounts/bank-accounts`
  - Writes to `gl_accounts` (bank fields + `is_bank_account=true`)
  - Also writes a `bank_accounts` row for transitional compatibility until Buildium sync is migrated (Phase 4)

Updated UI surfaces to consume the new endpoint:

- Add Property wizard step “Bank Account”: `src/components/AddPropertyModal.tsx`
- Property banking editor card: `src/components/property/PropertyBankingAndServicesCard.tsx`
- Banking modals: `src/components/BankingDetailsModal.tsx`, `src/components/legacy/BankingDetailsModal.tsx`

## Phase 4: Buildium Cutover (Bank Accounts → `gl_accounts`)

Phase 4 ensures all Buildium-facing code treats bank accounts as `gl_accounts` rows flagged with `is_bank_account = true`, and reads/writes Buildium IDs from `gl_accounts.buildium_gl_account_id`.

Key updates:

- Edge functions and webhook resolution use `gl_accounts.buildium_gl_account_id` and write `*_bank_gl_account_id` on properties.
  - `supabase/functions/buildium-sync/index.ts`
  - `supabase/functions/buildium-webhook/index.ts`
- Buildium-triggered bill payment ingestion resolves `BankAccountId` to `gl_accounts.id` (and only uses `bank_accounts` for legacy best-effort population).
  - `src/app/api/webhooks/buildium/route.ts`
- Monthly log owner draw uses `properties.operating_bank_gl_account_id` and reads bank mappings from `gl_accounts`.
  - `src/app/api/monthly-logs/[logId]/owner-draw/route.ts`
  - `src/app/api/monthly-logs/[logId]/owner-draw-options/route.ts`
- Escrow journal entries store `transactions.bank_gl_account_id` (bank line source is the bank GL account), with legacy `bank_account_id` only when needed.
  - `src/lib/escrow-calculations.ts`
  - `src/app/api/monthly-logs/[logId]/escrow/route.ts`
- Lease refund bank account selection now supports GL-backed bank accounts:
  - `src/app/api/leases/[id]/financial-options/route.ts` returns bank accounts from `gl_accounts`
  - `src/lib/lease-transaction-helpers.ts` resolves Buildium bank IDs from `gl_accounts` first, then falls back to `bank_accounts`
