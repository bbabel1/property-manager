# Double-Entry Balance Fixes: Entity Type Separation

## Implementation Date

2025-01-08

## Summary

This implementation fixes double-entry balance issues by properly separating Rental and Company entity transactions. Property-scoped financial queries now only include Rental entity transactions, ensuring accurate property cash balances and ledger views.

## Problem Statement

Previously, property financial calculations included both Rental and Company entity transactions, leading to:
- Incorrect property cash balances (including Company-level transactions)
- Inaccurate ledger views showing mixed entity types
- Double-counting of transactions in property-scoped queries

## Solution

Separate entity types at the database function and application level:
- Property-scoped queries default to filtering by 'Rental' entity type
- Global queries can optionally filter by entity type
- All transaction lines must have `account_entity_type` set (enforced by constraints)

## Migration Files (Apply in Order)

### 1. `20250108000000_backfill_account_entity_type.sql`

**Purpose**: Backfill missing `account_entity_type` values and add constraints

**Changes**:
- Backfills NULL `account_entity_type` values:
  - Lines linked to property/unit/lease: `'Rental'`
  - Lines with no property/unit/lease linkage: `'Company'`
- Adds default value `'Rental'` to prevent future NULLs
- Adds CHECK constraint to ensure `account_entity_type` is never NULL

**Impact**: All existing transaction lines will have `account_entity_type` set. New lines default to 'Rental'.

### 2. `20250108000001_fix_balance_entity_type_filtering.sql`

**Purpose**: Update `gl_account_balance_as_of()` to filter by entity type

**Changes**:
- Adds optional `p_entity_type` parameter
- Property-scoped queries default to `'Rental'` entity type
- Global queries can filter by provided entity type (or null = all types)
- Property-scoped balance calculations only include Rental transactions

**Function Signature**:
```sql
gl_account_balance_as_of(
  p_org_id uuid,
  p_gl_account_id uuid,
  p_as_of date,
  p_property_id uuid default null,
  p_entity_type public.entity_type_enum default null
)
```

**Impact**: Property cash balances now only include Rental entity transactions.

### 3. `20250108000002_fix_get_property_financials_entity_type.sql`

**Purpose**: Update `get_property_financials()` to only include Rental entity transactions

**Changes**:
- Filters `raw_lines` CTE to only include lines where `account_entity_type = 'Rental'`
- Ensures property cash balances exclude Company-level transactions
- All downstream calculations (bank totals, deposits, prepayments) use filtered data

**Impact**: Property financial snapshots now accurately reflect only Rental entity transactions.

### 4. `20250108000003_fix_v_gl_account_balances_entity_type.sql`

**Purpose**: Update `v_gl_account_balances_as_of()` to filter property-scoped balances by Rental entity type

**Changes**:
- Property-scoped aggregation (`property_agg` CTE) filters by `account_entity_type = 'Rental'`
- Global aggregation (`global_agg` CTE) includes all entity types (unchanged)
- Property-scoped rows in result set only show Rental entity balances

**Impact**: Property-scoped balance views show correct balances per entity type.

## Code Changes

### 1. `src/lib/finance/model.ts`

**Changes**:
- Added `account_entity_type?: 'Rental' | 'Company' | string | null` to `BasicLine` type
- Added `entityType?: 'Rental' | 'Company' | null` to `FinanceRollupParams` type
- Updated `rollupFinances()` to filter transaction lines by entity type when provided

**Usage**:
```typescript
rollupFinances({
  transactionLines: [...],
  entityType: 'Rental', // Optional: filter by entity type
  // ... other params
});
```

### 2. `src/app/(protected)/accounting/general-ledger/page.tsx`

**Changes**:
- Added `.eq('account_entity_type', 'Rental')` filter to property-scoped queries
- Property-filtered views only show Rental entity transactions
- Global views (no property filter) show all entity types

**Impact**: General ledger table shows correct balances when filtered by property.

### 3. `src/app/(protected)/properties/[id]/financials/ledger/page.tsx`

**Changes**:
- Added `.eq('account_entity_type', 'Rental')` filter to property ledger queries
- Ensures property-specific ledger only shows Rental entity transactions

**Impact**: Property ledger detail view shows accurate transaction history.

## Testing Recommendations

### 1. Verify Backfill

```sql
-- Check for any remaining NULL values (should return 0 rows)
SELECT COUNT(*) 
FROM transaction_lines 
WHERE account_entity_type IS NULL;

-- Verify backfill logic
SELECT 
  account_entity_type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE property_id IS NOT NULL OR unit_id IS NOT NULL OR lease_id IS NOT NULL) as linked_count
FROM transaction_lines
GROUP BY account_entity_type;
```

### 2. Test Property Cash Balances

```sql
-- Compare property financials before/after
SELECT 
  p.id,
  p.name,
  get_property_financials(p.id, CURRENT_DATE) as financials
FROM properties p
LIMIT 5;

-- Verify only Rental transactions included
SELECT 
  tl.account_entity_type,
  COUNT(*) as line_count,
  SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END) -
  SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END) as balance
FROM transaction_lines tl
JOIN gl_accounts ga ON ga.id = tl.gl_account_id
WHERE tl.property_id = '<property_id>'
  AND ga.is_bank_account = true
  AND tl.date <= CURRENT_DATE
GROUP BY tl.account_entity_type;
```

### 3. Test Balance Functions

```sql
-- Test property-scoped balance (should only include Rental)
SELECT 
  gl_account_balance_as_of(
    '<org_id>',
    '<gl_account_id>',
    CURRENT_DATE,
    '<property_id>'
  ) as property_balance;

-- Test global balance (should include all entity types)
SELECT 
  gl_account_balance_as_of(
    '<org_id>',
    '<gl_account_id>',
    CURRENT_DATE,
    NULL
  ) as global_balance;
```

### 4. Run Diagnostic Script

```bash
npx tsx scripts/diagnostics/check-double-entry-balance-issues.ts
```

**Note**: If this script doesn't exist, create it to verify:
- No NULL `account_entity_type` values
- Property balances only include Rental transactions
- Global balances include all entity types
- Ledger views show correct balances per entity type

### 5. UI Verification

1. Navigate to General Ledger page
2. Filter by a property
3. Verify only Rental entity transactions are shown
4. Remove property filter
5. Verify all entity types are shown

6. Navigate to Property Details → Financials → Ledger
7. Verify only Rental entity transactions are shown
8. Check that cash balances match expected values

## Migration Order

**Critical**: Apply migrations in this exact order:

1. `20250108000000_backfill_account_entity_type.sql` - Must run first to populate data
2. `20250108000001_fix_balance_entity_type_filtering.sql` - Updates balance function
3. `20250108000002_fix_get_property_financials_entity_type.sql` - Updates property financials
4. `20250108000003_fix_v_gl_account_balances_entity_type.sql` - Updates view function

## Rollback Plan

If issues are discovered:

1. **Revert code changes**: Remove entity type filters from UI components
2. **Revert function changes**: Restore previous function definitions
3. **Data**: The backfill migration is safe to re-run (idempotent)

**Note**: The backfill migration sets defaults but doesn't remove existing values, so rollback is safe.

## Key Improvements

1. **Entity type separation**: Rental and Company transactions are calculated separately
2. **Accurate property balances**: Property cash balances only include Rental entity transactions
3. **Correct ledger views**: Ledger tables show correct balances per entity type
4. **Data integrity**: All transaction lines must have `account_entity_type` set

## Related Documentation

- [Double-Entry Implementation](./DOUBLE_ENTRY_IMPLEMENTATION.md)
- [Double-Entry Vulnerabilities](./DOUBLE_ENTRY_VULNERABILITIES.md)

## Next Steps

1. Apply migrations in order (they are numbered sequentially)
2. Run the diagnostic script to verify fixes
3. Test property cash balances to ensure they only include Rental transactions
4. Verify ledger views show correct balances per entity type
5. Monitor for any edge cases or issues in production

