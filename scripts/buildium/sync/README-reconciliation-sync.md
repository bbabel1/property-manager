# Reconciliation Sync Verification

This directory contains scripts for running reconciliation sync and parity checks.

## Prerequisites

1. **Environment Variables** (in `.env.local` or `.env`):
   - `SUPABASE_SERVICE_ROLE_KEY` - Required for database access
   - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
   - `BUILDIUM_BASE_URL` - Buildium API base URL
   - `BUILDIUM_CLIENT_ID` - Buildium client ID
   - `BUILDIUM_CLIENT_SECRET` - Buildium client secret

2. **Running Next.js Server** (for API route approach):
   - Start dev server: `npm run dev`
   - Ensure you're authenticated (platform_admin role required)

## Method 1: Direct Script Execution

Run the sync script directly (bypasses API authentication):

```bash
# Sync all reconciliations (including finished)
npx tsx scripts/buildium/sync/sync-reconciliations.ts --includeFinished

# Sync specific bank account
npx tsx scripts/buildium/sync/sync-reconciliations.ts --bankAccountId=<uuid> --includeFinished

# Sync specific property's bank accounts
npx tsx scripts/buildium/sync/sync-reconciliations.ts --propertyId=<uuid> --includeFinished
```

Expected output:
```json
{
  "success": true,
  "totalAccounts": 2,
  "totalRecs": 5,
  "totalBalances": 5,
  "changes": 3,
  "totalTxnSyncs": 150,
  "totalUnmatched": 2,
  "syncErrors": 0
}
```

## Method 2: API Route (Requires Authentication)

If your Next.js server is running and you have platform_admin access:

```bash
# Get auth token first (from browser dev tools or Supabase dashboard)
# Then use it in the curl command:
curl -H "Authorization: Bearer <your-access-token>" \
  "http://localhost:3000/api/admin/sync/reconciliations?includeFinished=true"
```

## Balance Drift Check

After running the sync, check for balance drift:

1. **Find reconciliations to check:**
   ```sql
   SELECT
     rl.id,
     rl.bank_gl_account_id,
     rl.statement_ending_date,
     rl.ending_balance,
     ga.account_name
   FROM reconciliation_log rl
   JOIN gl_accounts ga ON ga.id = rl.bank_gl_account_id
   WHERE rl.ending_balance IS NOT NULL
   ORDER BY rl.statement_ending_date DESC
   LIMIT 10;
   ```

2. **Check drift for a specific reconciliation:**
   ```sql
   SELECT
     calculate_book_balance('<bank_gl_account_id>'::uuid, '<as_of>'::date) as local_cleared_balance,
     ending_balance as buildium_ending_balance,
     (ending_balance - calculate_book_balance('<bank_gl_account_id>'::uuid, '<as_of>'::date))::numeric(12,2) as drift
   FROM reconciliation_log
   WHERE bank_gl_account_id = '<bank_gl_account_id>'::uuid
     AND statement_ending_date = '<as_of>'::date
   ORDER BY statement_ending_date DESC
   LIMIT 1;
   ```

3. **Find all reconciliations with drift > 0.01:**
   ```sql
   SELECT
     rl.bank_gl_account_id,
     rl.statement_ending_date,
     calculate_book_balance(rl.bank_gl_account_id, rl.statement_ending_date) as local_cleared_balance,
     rl.ending_balance as buildium_ending_balance,
     (rl.ending_balance - calculate_book_balance(rl.bank_gl_account_id, rl.statement_ending_date))::numeric(12,2) as drift,
     ga.account_name
   FROM reconciliation_log rl
   JOIN gl_accounts ga ON ga.id = rl.bank_gl_account_id
   WHERE rl.ending_balance IS NOT NULL
     AND rl.statement_ending_date IS NOT NULL
     AND ABS(rl.ending_balance - calculate_book_balance(rl.bank_gl_account_id, rl.statement_ending_date)) > 0.01
   ORDER BY ABS(drift) DESC;
   ```

## Interpretation

- **totalTxnSyncs**: Number of transactions synced from Buildium
- **totalUnmatched**: Transactions in Buildium that couldn't be matched to local transactions
- **syncErrors**: Number of errors during sync
- **drift**: Difference between local cleared balance and Buildium ending balance
  - `|drift| > 0.01` indicates a mismatch that needs investigation
  - Positive drift: Local balance is lower than Buildium (missing transactions)
  - Negative drift: Local balance is higher than Buildium (extra transactions)

## Troubleshooting

1. **Service key not configured**: Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
2. **Unauthorized API**: Ensure you have platform_admin role and valid auth token
3. **No reconciliations found**: Check that bank accounts have `is_bank_account=true` and `buildium_gl_account_id` set
4. **High unmatched count**: Verify transaction mapping between Buildium and local database

