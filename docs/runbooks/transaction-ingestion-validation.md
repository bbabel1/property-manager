# Transaction Ingestion Validation Runbook

Use this after mapper changes or Buildium API schema changes to ensure payments/deposits still
map correctly (header fields, line metadata, and splits).

## Script

```bash
npx tsx scripts/buildium/assert-sample-transaction-ingestion.ts
```

Expected: prints `✅ Sample Buildium Payment/Deposit mapping assertion passed...` and exits 0.

## What it checks

- PaymentDetail → payee fields, payment_method_raw, internal transaction flags
- DepositDetails → bank_gl_account_buildium_id
- Bank/Undeposited Funds selection → when Buildium does not provide a bank GL, ensure we select
  org-scoped **Undeposited Funds** before falling back to property bank GLs, and persist the
  final `transactions.bank_gl_account_id`.
- Line metadata → reference_number, is_cash_posting, accounting_entity_type_raw
- DepositDetails.PaymentTransactions → rows in transaction_payment_transactions

## When to run

- After any mapper change touching transactions/lines/splits
- After Buildium API schema changes for payments/deposits
- Before/after backfills that adjust transaction lines or splits

## If it fails

1. Read the error message for the missing field.
2. Update the mapper in `src/lib/buildium-mappers.ts` to include the missing field.
3. Re-run the script to confirm.
4. If the production data path is affected, rerun the backfill or targeted upsert for impacted
   Buildium transaction IDs.
