# Double-Entry Bookkeeping Balance Fixes - Implementation Summary

## Overview

This document summarizes the fixes implemented to resolve double-entry bookkeeping balance calculation issues related to entity type filtering.

## Issues Fixed

### 1. Missing Entity Type Filtering ✅

**Problem**: Balance calculations did not filter by `account_entity_type`, causing incorrect balances when Company-level transactions were included in Rental (property) calculations.

**Solution**: Added entity type filtering to all balance calculation functions and queries.

### 2. Cash Balance Calculation Issues ✅

**Problem**: Cash balance calculations included transaction lines from all entity types, not just the relevant entity type.

**Solution**: Updated `get_property_financials()` and finance model to filter by Rental entity type for property-level calculations.

### 3. Ledger Table Balance Issues ✅

**Problem**: Ledger tables calculated running balances without filtering by entity type.

**Solution**: Updated ledger queries to filter by Rental entity type when property filters are applied.

## Migrations Created

### 1. `20250108000000_backfill_account_entity_type.sql`

**Purpose**: Backfill missing `account_entity_type` values and add constraints to prevent NULL values.

**Changes**:
- Sets `account_entity_type = 'Rental'` for lines linked to properties/units/leases
- Sets `account_entity_type = 'Company'` for lines not linked to properties/units/leases
- Adds default value of 'Rental' for new rows
- Adds CHECK constraint to prevent NULL values

### 2. `20250108000001_fix_balance_entity_type_filtering.sql`

**Purpose**: Fix `gl_account_balance_as_of()` to filter by entity type.

**Changes**:
- Added `p_entity_type` parameter (optional)
- For property-scoped queries (`p_property_id` provided), defaults to filtering by 'Rental' entity type
- For global queries, filters by provided entity type or includes all if null
- Updated function comment to document entity type filtering behavior

### 3. `20250108000002_fix_get_property_financials_entity_type.sql`

**Purpose**: Fix `get_property_financials()` to only include Rental entity type transactions.

**Changes**:
- Added filter `tl.account_entity_type = 'Rental'` in `raw_lines` CTE
- Ensures property cash balances only include Rental entity transactions
- Updated function comment to document entity type filtering

### 4. `20250108000003_fix_v_gl_account_balances_entity_type.sql`

**Purpose**: Fix `v_gl_account_balances_as_of()` to filter property-scoped balances by Rental entity type.

**Changes**:
- Global aggregation includes all entity types (unchanged)
- Property-scoped aggregation (`property_agg` CTE) filters by `account_entity_type = 'Rental'`
- Updated function comment to document entity type filtering

## Code Changes

### 1. `src/lib/finance/model.ts`

**Changes**:
- Added `account_entity_type?: string | null` to `BasicLine` type
- Added `entityType?: 'Rental' | 'Company' | null` to `FinanceRollupParams` type
- Updated `rollupFinances()` to filter transaction lines by entity type when provided

### 2. `src/app/(protected)/accounting/general-ledger/page.tsx`

**Changes**:
- Added `account_entity_type` to transaction_lines select query
- Added `.eq('account_entity_type', 'Rental')` filter when property filters are applied
- Ensures property-specific ledger views only show Rental entity transactions

### 3. `src/app/(protected)/properties/[id]/financials/ledger/page.tsx`

**Changes**:
- Added `.eq('account_entity_type', 'Rental')` filter to property-specific ledger queries
- Ensures property ledger detail pages only show Rental entity transactions

## Testing Recommendations

1. **Run Diagnostic Script**: Execute `scripts/diagnostics/check-double-entry-balance-issues.ts` to verify fixes
2. **Verify Property Cash Balances**: Check that property cash balances only include Rental entity transactions
3. **Check GL Account Balances**: Verify GL account balances are calculated correctly per entity type
4. **Test Ledger Views**: Ensure ledger tables show correct balances per entity type
5. **Validate Backfill**: Verify all transaction lines have `account_entity_type` set after migration

## Migration Order

1. Apply `20250108000000_backfill_account_entity_type.sql` first to ensure all rows have entity type
2. Apply `20250108000001_fix_balance_entity_type_filtering.sql` to fix `gl_account_balance_as_of()`
3. Apply `20250108000002_fix_get_property_financials_entity_type.sql` to fix property financials
4. Apply `20250108000003_fix_v_gl_account_balances_entity_type.sql` to fix GL account balances view

## Breaking Changes

⚠️ **Important**: After applying these migrations:

1. Property cash balances will only include Rental entity transactions (previously included all)
2. GL account balances per property will only include Rental entity transactions
3. Ledger views with property filters will only show Rental entity transactions
4. All transaction lines must have `account_entity_type` set (constraint added)

## Rollback Plan

If issues occur, migrations can be rolled back in reverse order. However, note that:
- The CHECK constraint prevents NULL values, so rolling back the first migration requires dropping the constraint first
- Balance calculations will revert to including all entity types (which was the original bug)

## Related Documentation

- `docs/database/DOUBLE_ENTRY_BALANCE_ISSUES.md` - Original issue analysis
- `scripts/diagnostics/check-double-entry-balance-issues.ts` - Diagnostic script
