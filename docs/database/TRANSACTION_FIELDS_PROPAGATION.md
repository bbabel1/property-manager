# Transaction Fields Propagation - Implementation Summary

## Overview
This document tracks the propagation of new Buildium-aligned transaction fields (from migration `20260402090000_buildium_transaction_schema_extension.sql`) across UI surfaces and sync handlers.

## New Transaction Fields

### Header Fields (transactions table)
- `buildium_last_updated_at` - Sync freshness timestamp
- `payment_method_raw` - Raw PaymentMethod from Buildium
- `payee_buildium_id`, `payee_buildium_type`, `payee_name`, `payee_href` - Payee details
- `is_internal_transaction`, `internal_transaction_is_pending`, `internal_transaction_result_date`, `internal_transaction_result_code` - Internal transfer status
- `buildium_unit_id`, `unit_id`, `buildium_unit_number` - Unit references
- `buildium_application_id` - Application reference
- `unit_agreement_id`, `unit_agreement_type`, `unit_agreement_href` - Unit agreement details
- `bank_gl_account_buildium_id` - Bank GL account reference

### Line Fields (transaction_lines table)
- `reference_number` - Line-level reference
- `is_cash_posting` - Cash posting flag
- `accounting_entity_type_raw` - Raw accounting entity type

### Payment Splits (transaction_payment_transactions table)
- New table for DepositDetails.PaymentTransactions
- Tracks splits and accounting entities
- RLS policies mirror transactions table

## UI Surfaces Updated

### ✅ Monthly Log Transaction Detail Dialog
**File**: `src/components/monthly-logs/TransactionDetailDialog.tsx`

**Changes**:
- Added payee name display
- Added unit number display
- Added internal transfer status (Pending/Completed)

**Fields Displayed**:
- Payee (if available)
- Unit (if available)
- Internal Transfer status (if applicable)

### ✅ Lease Ledger Panel
**File**: `src/components/leases/LeaseLedgerPanel.tsx`

**Changes**:
- Extracts payee from `PaymentDetail.Payee.Name`
- Extracts unit number from `UnitNumber`
- Extracts internal transfer status from `PaymentDetail.IsInternalTransaction`

**Fields Displayed**:
- Payee (from Buildium detail)
- Unit (from Buildium detail)
- Internal Transfer status (Pending/Completed)

### ✅ TypeScript Types
**File**: `src/types/monthly-log.ts`

**Changes**:
- Extended `MonthlyLogTransaction` interface with new optional fields
- All new fields are nullable to maintain backward compatibility

**New Fields in Type**:
```typescript
payee_name?: string | null;
payee_buildium_id?: number | null;
payee_buildium_type?: string | null;
is_internal_transaction?: boolean | null;
internal_transaction_is_pending?: boolean | null;
bank_gl_account_buildium_id?: number | null;
buildium_unit_id?: number | null;
buildium_unit_number?: string | null;
unit_agreement_id?: number | null;
unit_agreement_type?: string | null;
```

## Buildium Sync Handlers Status

### ✅ Lease Transactions
**File**: `src/lib/buildium-mappers.ts` - `upsertLeaseTransactionWithLines()`

**Status**: **Already Aligned**

**Implementation**:
- Populates all new header fields from Buildium payloads
- Handles `PaymentDetail` payee information
- Handles `DepositDetails.PaymentTransactions` splits (lines 2005-2026)
- Populates `bank_gl_account_buildium_id` from `DepositDetails.BankGLAccountId`
- Handles unit references and internal transaction status

**Payment Splits**:
- Deletes existing splits before inserting new ones
- Maps all split fields: `buildium_payment_transaction_id`, `accounting_entity_id`, `accounting_entity_type`, `accounting_entity_href`, `accounting_unit_id`, `accounting_unit_href`, `amount`

### ✅ Bills
**File**: `src/lib/buildium-mappers.ts` - `upsertBillWithLines()`

**Status**: **Out of Scope (Intentional)**

**Reason**: Bill transactions don't have payment-specific fields like payee, internal transaction status, or payment splits. Bills use different Buildium schema fields (vendor, due date, paid date).

**Current Implementation**: Correct - no changes needed.

### ✅ GL Entries (Journal Entries)
**File**: `src/lib/buildium-mappers.ts` - `upsertGLEntryWithLines()`

**Status**: **Out of Scope (Intentional)**

**Reason**: General journal entries don't have payment-specific fields. They use GL account allocations and don't involve payees or deposits.

**Current Implementation**: Correct - no changes needed.

## Surfaces That Don't Need Updates

### Journal Entry Detail Page
**File**: `src/app/(protected)/properties/[id]/financials/entries/[transactionId]/page.tsx`

**Reason**: This page is for editing general journal entries, which don't have payment-specific fields. The new fields are only relevant for payment/deposit transactions.

### Transaction Detail Shell
**File**: `src/components/transactions/TransactionDetailShell.tsx`

**Reason**: This is a generic shell component that accepts `detailItems` as props. The specific fields are passed in by parent components (already updated above).

## Data Flow

```
Buildium API
    ↓
upsertLeaseTransactionWithLines()
    ↓
transactions table (new fields populated)
transaction_payment_transactions table (splits)
    ↓
API routes (RLS enforced)
    ↓
UI Components (display new fields)
```

## RLS Security

All new data is protected by existing and new RLS policies:
- `transactions` - org-scoped read/write policies
- `transaction_payment_transactions` - org-scoped policies (mirrors transactions)
- Users can only access transactions/splits in their organization
- Role-based write access (admins/managers only)

## Verification

Run the audit script to verify data integrity:

```bash
npx tsx scripts/database/audit-transaction-fields.ts
```

Expected results:
- No orphaned payment splits
- All deposits with `bank_gl_account_buildium_id` have corresponding splits
- Double-entry balanced transactions

## Migration History

1. `20260402090000_buildium_transaction_schema_extension.sql` - Added new fields
2. `20260402091000_transaction_payment_transactions_rls.sql` - Added RLS policies

## Future Considerations

### Potential Enhancements
1. **Payment Split UI**: Display individual payment splits in transaction detail views
2. **Bank Account Display**: Show bank account name instead of just ID
3. **Unit Agreement Details**: Link to unit agreement records if/when implemented
4. **Internal Transfer Tracking**: Add UI to track internal transfer status changes

### API Endpoints
If new API endpoints are added for transactions, ensure they:
- Include new fields in SELECT queries
- Handle new fields in POST/PUT payloads
- Respect RLS policies for `transaction_payment_transactions`

## Testing Checklist

- [x] New fields in database types (`src/types/database.remote.ts`)
- [x] TypeScript types updated (`src/types/monthly-log.ts`)
- [x] Monthly log transaction dialog displays new fields
- [x] Lease ledger panel displays new fields
- [x] Buildium sync handlers populate new fields
- [x] RLS policies protect new table
- [x] No linter errors
- [x] Backward compatibility maintained (all fields nullable)

## Related Documentation

- [Transaction Payment Splits RLS](./TRANSACTION_PAYMENT_SPLITS_RLS.md)
- [Buildium Transaction Schema Extension](./RBAC_UI_MAPPING_UPDATED_TRANSACTIONS.md)
- [SQL Audit Queries](./SQL_AUDIT_NEW_TRANSACTION_FIELDS.md)

