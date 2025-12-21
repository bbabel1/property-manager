# Transactions & Payment Splits – RBAC/UI considerations

This note captures the new Buildium-aligned transaction fields and the `transaction_payment_transactions` table so we can surface them correctly in UI flows and secure them with RLS.

## New transaction columns (header)
- `buildium_last_updated_at` — sync freshness from Buildium
- `payment_method_raw` — raw PaymentDetail method (UI should prefer normalized `payment_method` when present)
- `payee_buildium_id`, `payee_buildium_type`, `payee_name`, `payee_href`
- `is_internal_transaction`, `internal_transaction_is_pending`, `internal_transaction_result_date`, `internal_transaction_result_code`
- `buildium_unit_id`, `unit_id`, `buildium_unit_number`
- `buildium_application_id`
- `unit_agreement_id`, `unit_agreement_type`, `unit_agreement_href`
- `bank_gl_account_id`, `bank_gl_account_buildium_id`

## New line metadata (transaction_lines)
- `reference_number`
- `is_cash_posting`
- `accounting_entity_type_raw` (raw Buildium AccountingEntityType)

## New table: `transaction_payment_transactions`
- Captures DepositDetails.PaymentTransactions splits:
  - `transaction_id` (FK to transactions, CASCADE delete)
  - `buildium_payment_transaction_id`
  - `accounting_entity_id`, `accounting_entity_type`, `accounting_entity_href`
  - `accounting_unit_id`, `accounting_unit_href`
  - `amount`
  - timestamps

## UI surfaces to update
- Transaction detail panes (leases, properties, units): include payee/internal status, bank GL, unit/application, and splits.
- Receipts/deposit views: show PaymentTransactions splits and bank GL.
- Financial reports that depend on cash vs. non-cash postings: use `is_cash_posting`/`reference_number` when present.

## RLS / access considerations
- `transaction_payment_transactions` should mirror `transactions` org/lease scoping for read/write. Ensure policies restrict to the same org/lease visibility used for `transactions`.
- When selecting transactions, prefer joins that stay within the user’s org scope; do not expose raw Buildium hrefs/types to unauthorized orgs.

## API alignment
- Lease transaction detail route now returns the new fields (PaymentDetail, DepositDetails, lines). Extend other transaction endpoints similarly if they drive UI.
