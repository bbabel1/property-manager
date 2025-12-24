# Double-Entry Bookkeeping Implementation Summary

This document summarizes the implementation of Phase 1 fixes for double-entry bookkeeping vulnerabilities.

## Implementation Date

2025-02-01

## Phase 1: Foundation - Completed ✅

### 1. Standardized Tolerance Constant

**File**: `src/lib/accounting-validation.ts`

- ✅ Exported `DOUBLE_ENTRY_TOLERANCE = 0.01` constant
- ✅ Updated `assertTransactionBalanced()` to use this constant as default
- ✅ Added JSDoc documentation explaining the tolerance value

**Changes**:

- Replaced `DEFAULT_TOLERANCE` with exported `DOUBLE_ENTRY_TOLERANCE`
- All validation now uses the standardized constant

### 2. Enhanced `assertTransactionBalanced()` Function

**File**: `src/lib/accounting-validation.ts`

- ✅ Added check for at least one debit AND one credit line
- ✅ Removed optional validation paths
- ✅ Enhanced error messages to include debit/credit counts
- ✅ Added comprehensive JSDoc documentation

**New Validation Rules**:

1. Transaction must have at least one debit line
2. Transaction must have at least one credit line
3. Total debits must equal total credits within tolerance (0.01)

**Error Messages**:

- If missing debit/credit: `"Transaction must have at least one debit and one credit line (found X debits, Y credits)"`
- If unbalanced: `"Transaction is unbalanced (debits=X, credits=Y, difference=Z, tolerance=0.01)"`

### 3. SQL Functions for Atomic Operations

**File**: `supabase/migrations/20250201120000_double_entry_validation_functions.sql`

#### `validate_transaction_balance(p_transaction_id, p_tolerance)`

- Validates double-entry balance at database level
- Requires at least one debit and one credit
- Validates debits = credits within tolerance
- Uses `SECURITY DEFINER` for proper permissions
- Returns void, raises exception on failure

#### `replace_transaction_lines(p_transaction_id, p_lines, p_validate_balance)`

- Atomically replaces all transaction lines for a transaction
- Uses `FOR UPDATE` locking to prevent race conditions
- Handles `BEGIN/EXCEPTION/ROLLBACK` automatically
- Validates balance by default (can be disabled)
- Accepts JSONB array of line objects
- Handles all transaction_line fields including nullable ones

**Features**:

- Row-level locking prevents concurrent modifications
- Automatic rollback on any error
- Validates balance before committing
- Supports all transaction_line columns

### 4. Database Trigger for Automatic Validation

**File**: `supabase/migrations/20250201120000_double_entry_validation_functions.sql`

#### `trg_validate_transaction_balance()`

- Trigger function that validates balance after any line change
- Works for INSERT, UPDATE, and DELETE operations
- Uses deferred constraint trigger to allow multi-line inserts
- Automatically validates balance at transaction commit

**Trigger**: `trg_transaction_lines_validate_balance`

- Type: CONSTRAINT TRIGGER
- Timing: AFTER INSERT OR UPDATE OR DELETE
- Deferrable: INITIALLY DEFERRED (allows multi-line inserts)
- Scope: FOR EACH ROW

## Usage Examples

### Using the Enhanced Validator

```typescript
import { assertTransactionBalanced, DOUBLE_ENTRY_TOLERANCE } from '@/lib/accounting-validation';

// After modifying transaction lines
await assertTransactionBalanced(transactionId, db, DOUBLE_ENTRY_TOLERANCE);
```

### Using the SQL Function for Atomic Replace

```typescript
// Convert lines to JSONB format
const linesJsonb = [
  {
    gl_account_id: accountId1,
    amount: 100.0,
    posting_type: 'Debit',
    memo: 'Expense',
    account_entity_type: 'Rental',
    property_id: propertyId,
    date: '2025-02-01',
    // ... other fields
  },
  {
    gl_account_id: accountId2,
    amount: 100.0,
    posting_type: 'Credit',
    memo: 'Payable',
    account_entity_type: 'Company',
    date: '2025-02-01',
    // ... other fields
  },
];

// Atomically replace lines
const { error } = await admin.rpc('replace_transaction_lines', {
  p_transaction_id: transactionId,
  p_lines: linesJsonb,
  p_validate_balance: true, // default
});

if (error) {
  // Transaction was rolled back automatically
  throw new Error(`Failed to replace lines: ${error.message}`);
}
```

## Next Steps (Phase 2)

The following endpoints should be updated to use the new SQL function:

1. `src/app/api/bills/[id]/route.ts` (PATCH)
2. `src/app/api/journal-entries/[transactionId]/route.ts` (PUT)
3. `src/app/api/bank-accounts/[id]/transfers/[transactionId]/route.ts` (PATCH)
4. `src/app/api/bank-accounts/[id]/checks/[transactionId]/route.ts` (PATCH)
5. Buildium webhook handlers

## Migration Instructions

1. Apply the migration:

   ```bash
   npx supabase db push
   ```

2. Update application code to use `assertTransactionBalanced()` with `DOUBLE_ENTRY_TOLERANCE`

3. Gradually migrate endpoints to use `replace_transaction_lines()` SQL function

4. Test thoroughly to ensure existing transactions remain valid

## Breaking Changes

⚠️ **Important**: The database trigger will now enforce double-entry rules. Any existing unbalanced transactions will cause errors when:

- New lines are added to the transaction
- Existing lines are updated
- Lines are deleted (if remaining lines are unbalanced)

**Recommendation**: Run an audit query to find unbalanced transactions before deploying:

```sql
SELECT
  t.id,
  t.transaction_type,
  COUNT(*) FILTER (WHERE tl.posting_type = 'Debit') as debit_count,
  COUNT(*) FILTER (WHERE tl.posting_type = 'Credit') as credit_count,
  COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Debit'), 0) as debit_total,
  COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Credit'), 0) as credit_total,
  ABS(COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Debit'), 0) -
      COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Credit'), 0)) as difference
FROM transactions t
LEFT JOIN transaction_lines tl ON tl.transaction_id = t.id
GROUP BY t.id, t.transaction_type
HAVING
  COUNT(*) FILTER (WHERE tl.posting_type = 'Debit') = 0 OR
  COUNT(*) FILTER (WHERE tl.posting_type = 'Credit') = 0 OR
  ABS(COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Debit'), 0) -
      COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Credit'), 0)) > 0.01;
```

## Testing

After implementation, verify:

1. ✅ Balanced transactions work correctly
2. ✅ Unbalanced transactions are rejected
3. ✅ One-sided transactions are rejected
4. ✅ Concurrent updates are handled correctly (locking works)
5. ✅ Rollback works on errors
6. ✅ Multi-line inserts work (deferred trigger)

## Files Modified

- `src/lib/accounting-validation.ts` - Enhanced validation with standardized tolerance
- `supabase/migrations/20250201120000_double_entry_validation_functions.sql` - New SQL functions and trigger

## Related Documentation

- [DOUBLE_ENTRY_VULNERABILITIES.md](./DOUBLE_ENTRY_VULNERABILITIES.md) - Full vulnerability analysis
