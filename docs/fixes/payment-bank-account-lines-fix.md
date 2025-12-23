# Payment Bank Account Lines Fix

## Problem

When tenants made payments (Rent Income or Security Deposits), the transaction was missing a debit
line to the property's bank account ("Trust"). This caused the Cash Balance calculation to be
incorrect because it only saw credit lines (to AR/Revenue) but no corresponding bank account debit.

## Solution

Added logic to automatically create the missing bank account debit line when processing Payment and ApplyDeposit transactions.

## Files Modified

### 1. Core Mapper (`src/lib/buildium-mappers.ts`)

- Added detection for `Payment` and `ApplyDeposit` transaction types
- Checks if bank account line exists in Buildium's response
- If missing, resolves property's bank GL account and adds debit line
- Ensures double-entry accounting integrity

### 2. Webhook Handler (`supabase/functions/buildium-lease-transactions/index.ts`)

- Same logic for transactions coming from Buildium webhooks
- Handles edge function environment

### 3. Sync Function (`supabase/functions/buildium-sync/index.ts`)

- Same logic for batch sync operations
- Ensures consistency across all code paths

### 4. Date Display Fix (`src/components/property/PropertyBankingAndServicesCard.tsx`)

- Fixed timezone issue causing "As of" date to show incorrectly
- Formats date string directly without timezone conversion

## Testing

### Step 1: Test Current State

Run the test script to see which transactions are missing bank lines:

```bash
npx tsx scripts/test-payment-bank-lines.ts
```

This will:

- List all recent Payment/ApplyDeposit transactions
- Show which ones have bank account lines
- Show which ones are missing bank account lines
- Display details about missing lines

### Step 2: Fix Existing Transactions

Run the backfill script to add missing bank account lines:

```bash
npx tsx scripts/fix-missing-bank-account-lines.ts
```

This will:

- Find all Payment and ApplyDeposit transactions missing bank lines
- Add the missing debit lines to the bank account
- Report how many were fixed, skipped, or had errors

### Step 3: Verify Cash Balance

1. Navigate to a property's summary page
2. Check the "Banking & Financials" card
3. Verify the Cash Balance matches expected value
4. Verify the "As of" date is correct (should be today's date)

### Step 4: Test New Payments

1. Create a new payment (Rent Income or Security Deposit)
2. Check the transaction_lines table - should have 3+ lines:
   - Credit line(s) to AR/Revenue accounts
   - Debit line to bank account (Trust)
3. Verify Cash Balance updates correctly

## Expected Behavior

### Before Fix

- Payment transaction: 2 lines (Credit to AR, Credit to Revenue)
- Cash Balance: Incorrect (missing bank account debit)

### After Fix

- Payment transaction: 3+ lines (Credit to AR, Credit to Revenue, **Debit to Bank**)
- Cash Balance: Correct (includes bank account transactions)

## Verification Queries

Check if a transaction has a bank account line:

```sql
SELECT
  t.id,
  t.transaction_type,
  t.date,
  COUNT(tl.id) as total_lines,
  COUNT(CASE WHEN ga.is_bank_account THEN 1 END) as bank_lines
FROM transactions t
LEFT JOIN transaction_lines tl ON tl.transaction_id = t.id
LEFT JOIN gl_accounts ga ON ga.id = tl.gl_account_id
WHERE t.transaction_type IN ('Payment', 'ApplyDeposit')
GROUP BY t.id, t.transaction_type, t.date
ORDER BY t.date DESC
LIMIT 20;
```

Check cash balance calculation:

```sql
SELECT
  p.id as property_id,
  p.name,
  SUM(CASE
    WHEN tl.posting_type = 'Debit' THEN tl.amount
    WHEN tl.posting_type = 'Credit' THEN -tl.amount
    ELSE 0
  END) as calculated_cash_balance
FROM properties p
JOIN transaction_lines tl ON tl.property_id = p.id
JOIN gl_accounts ga ON ga.id = tl.gl_account_id
WHERE ga.is_bank_account = true
  AND (ga.id = p.operating_bank_gl_account_id OR ga.id = p.deposit_trust_gl_account_id)
GROUP BY p.id, p.name;
```

## Notes

- The fix only applies to transactions that have credit lines (allocations to AR/Revenue)
- If a property doesn't have a bank GL account configured, the line won't be added (this is expected)
- The debit amount equals the sum of all credit lines to maintain double-entry accounting
- Edge functions (webhooks) run in Deno, so they can't use the same logging mechanism
