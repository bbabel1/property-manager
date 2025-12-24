# Double-Entry Bookkeeping Balance Issues

## Overview

This document identifies broken logic in the double-entry bookkeeping feature related to balance calculations per Entity Type and Cash Balance calculations.

## Critical Issues Found

### 1. Missing Entity Type Filtering in Balance Calculations

**Problem**: Balance calculations do not filter by `account_entity_type`, causing incorrect balances when Company-level transactions are included in Rental (property) calculations.

**Affected Functions**:
- `gl_account_balance_as_of()` - Does not filter by `account_entity_type`
- `get_property_financials()` - Does not filter by `account_entity_type`
- `v_gl_account_balances_as_of()` - Does not filter by `account_entity_type`
- Cash balance calculations in `src/lib/finance/model.ts` - Does not filter by `account_entity_type`
- Ledger balance calculations - Do not filter by `account_entity_type`

**Impact**:
- Property cash balances may include Company-level transactions
- GL account balances per entity type are incorrect
- Ledger tables show wrong balances per entity type
- Financial reports may show inflated or incorrect balances

**Example Scenario**:
1. A Company-level transaction posts $1000 to a bank GL account with `account_entity_type = 'Company'`
2. A Rental-level transaction posts $500 to the same bank GL account with `account_entity_type = 'Rental'`
3. Property financials query includes both transactions, showing $1500 instead of $500
4. This causes incorrect cash balance on property pages

### 2. Cash Balance Calculation Issues

**Problem**: Cash balance calculations include transaction lines from all entity types, not just the relevant entity type.

**Location**: 
- `src/lib/finance/model.ts` - `rollupFinances()` function
- `supabase/migrations/20270131070000_fix_cash_balance_prioritize_bank_lines.sql` - `get_property_financials()` function

**Impact**:
- Property cash balances include Company-level bank transactions
- Unit cash balances may include wrong entity type transactions
- Available balance calculations are incorrect

### 3. Ledger Table Balance Issues

**Problem**: Ledger tables calculate running balances without filtering by entity type.

**Location**:
- `src/app/(protected)/accounting/general-ledger/page.tsx`
- `src/app/(protected)/properties/[id]/financials/ledger/page.tsx`
- `src/server/financials/ledger-utils.ts` - `buildLedgerGroups()` function

**Impact**:
- General ledger shows incorrect balances per GL account
- Property-specific ledger shows incorrect balances
- Running balances include transactions from wrong entity types

### 4. Missing account_entity_type Validation

**Problem**: Some transaction lines have `NULL` `account_entity_type`, causing ambiguity in balance calculations.

**Impact**:
- Unclear which entity type these lines belong to
- Balance calculations may exclude or incorrectly include these lines
- Data integrity issues

## Root Cause Analysis

The `account_entity_type` field exists on `transaction_lines` table but is not consistently used in balance calculations. The field indicates whether a transaction line belongs to:
- `'Rental'` - Property/unit/lease level transactions
- `'Company'` - Company-level transactions

However, balance calculation functions filter by `property_id`, `unit_id`, `lease_id`, etc., but do not filter by `account_entity_type`. This means:

1. Company-level transactions that happen to be linked to a property (via bank GL account) are included in property balances
2. Property-level balances may include Company-level transactions
3. GL account balances don't properly separate Rental vs Company balances

## Recommended Fixes

### Fix 1: Add Entity Type Filtering to Balance Functions

**File**: `supabase/migrations/[timestamp]_fix_balance_entity_type_filtering.sql`

```sql
-- Fix gl_account_balance_as_of to filter by account_entity_type
CREATE OR REPLACE FUNCTION public.gl_account_balance_as_of(
  p_org_id uuid,
  p_gl_account_id uuid,
  p_as_of date,
  p_property_id uuid default null,
  p_entity_type text default null -- NEW: filter by entity type
) RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
-- Add filter: AND (p_entity_type IS NULL OR tl.account_entity_type = p_entity_type)
-- ...
$$;

-- Fix get_property_financials to only include Rental entity type
CREATE OR REPLACE FUNCTION public.get_property_financials(
    p_property_id uuid,
    p_as_of date default current_date
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
-- Add filter: AND (tl.account_entity_type = 'Rental' OR tl.account_entity_type IS NULL)
-- ...
$$;
```

### Fix 2: Update Finance Model to Filter by Entity Type

**File**: `src/lib/finance/model.ts`

Add entity type filtering to `rollupFinances()` function:

```typescript
export function rollupFinances(
  params: FinanceRollupParams & { entityType?: 'Rental' | 'Company' }
): FinanceRollupResult {
  const transactionLines = Array.isArray(params.transactionLines) 
    ? params.transactionLines.filter(line => 
        !params.entityType || line.account_entity_type === params.entityType
      )
    : [];
  // ... rest of function
}
```

### Fix 3: Update Ledger Queries to Filter by Entity Type

**Files**:
- `src/app/(protected)/accounting/general-ledger/page.tsx`
- `src/app/(protected)/properties/[id]/financials/ledger/page.tsx`

Add entity type filtering to transaction_lines queries:

```typescript
// For property-specific queries, filter by Rental entity type
.eq('account_entity_type', 'Rental')
```

### Fix 4: Backfill Missing account_entity_type Values

**File**: `supabase/migrations/[timestamp]_backfill_account_entity_type.sql`

```sql
-- Backfill account_entity_type based on property_id presence
UPDATE transaction_lines
SET account_entity_type = 'Rental'
WHERE account_entity_type IS NULL
  AND (property_id IS NOT NULL OR unit_id IS NOT NULL OR lease_id IS NOT NULL);

UPDATE transaction_lines
SET account_entity_type = 'Company'
WHERE account_entity_type IS NULL
  AND property_id IS NULL
  AND unit_id IS NULL
  AND lease_id IS NULL;
```

## Testing Strategy

1. **Run Diagnostic Script**: Use `scripts/diagnostics/check-double-entry-balance-issues.ts` to identify specific issues
2. **Verify Entity Type Separation**: Ensure Rental and Company balances are calculated separately
3. **Check Cash Balance Accuracy**: Verify property cash balances only include Rental entity transactions
4. **Validate Ledger Balances**: Ensure ledger tables show correct balances per entity type
5. **Test Edge Cases**: 
   - Transactions with NULL entity_type
   - Company transactions linked to properties via bank GL accounts
   - Mixed entity type transactions in same GL account

## Migration Plan

1. **Phase 1**: Backfill missing `account_entity_type` values
2. **Phase 2**: Update balance calculation functions to filter by entity type
3. **Phase 3**: Update application code to pass entity type filters
4. **Phase 4**: Verify balances are correct after migration
5. **Phase 5**: Add validation to prevent NULL entity_type in future

## Related Files

- `supabase/migrations/20280402120000_update_bank_balance_from_transactions.sql`
- `supabase/migrations/20270131070000_fix_cash_balance_prioritize_bank_lines.sql`
- `src/lib/finance/model.ts`
- `src/server/financials/ledger-utils.ts`
- `src/app/(protected)/accounting/general-ledger/page.tsx`
- `src/app/(protected)/properties/[id]/financials/ledger/page.tsx`

## Notes

- The `account_entity_type` field was added to support multi-entity accounting but filtering was never implemented
- This is a data integrity issue that affects financial accuracy
- Fixes should be applied carefully to avoid breaking existing reports
- Consider adding database constraints to ensure entity_type is always set
