# Push Migrations - Quick Guide

## ✅ All Migration Files Ready

The following migration files are ready in `supabase/migrations/`:
1. `20250108000000_backfill_account_entity_type.sql`
2. `20250108000001_fix_balance_entity_type_filtering.sql`
3. `20250108000002_fix_get_property_financials_entity_type.sql`
4. `20250108000003_fix_v_gl_account_balances_entity_type.sql`

## 🚀 Quick Push Methods

### Method 1: Supabase CLI (Fastest)

```bash
# If not already linked
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
npx supabase db push
```

### Method 2: Via Next.js API Route

I've created an API endpoint that can execute migrations:

```bash
# Start dev server
npm run dev

# In another terminal, call the API
curl -X POST http://localhost:3000/api/admin/apply-migrations
```

### Method 3: Manual (Most Reliable)

1. Open `MIGRATIONS_TO_APPLY.sql` 
2. Go to **Supabase Dashboard > SQL Editor**
3. Copy each migration section (marked with `===`)
4. Paste and run each migration in order (1, 2, 3, 4)
5. Verify: `SELECT COUNT(*) FROM transaction_lines WHERE account_entity_type IS NULL;` (should return 0)

## 📋 What These Migrations Do

1. **Migration 1**: Backfills missing `account_entity_type` values
2. **Migration 2**: Fixes `gl_account_balance_as_of()` to filter by entity type
3. **Migration 3**: Fixes `get_property_financials()` to only include Rental transactions
4. **Migration 4**: Fixes `v_gl_account_balances_as_of()` to filter property balances

## ✅ Verification

After applying, verify with:
```sql
SELECT COUNT(*) FROM transaction_lines WHERE account_entity_type IS NULL;
-- Should return 0

SELECT conname FROM pg_constraint 
WHERE conname = 'transaction_lines_account_entity_type_not_null';
-- Should return the constraint name
```
