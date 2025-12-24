# Apply Double-Entry Bookkeeping Balance Fix Migrations

## Quick Start

Apply these 4 migrations in order using **Supabase Dashboard > SQL Editor**.

## Migration 1: Backfill account_entity_type

```sql
-- Backfill missing account_entity_type values based on property_id/unit_id/lease_id presence
-- This ensures all transaction lines have a valid entity type for proper balance calculations

begin;

-- Set account_entity_type to 'Rental' for lines linked to properties/units/leases
UPDATE public.transaction_lines
SET account_entity_type = 'Rental'::public.entity_type_enum
WHERE account_entity_type IS NULL
  AND (
    property_id IS NOT NULL 
    OR unit_id IS NOT NULL 
    OR lease_id IS NOT NULL
    OR buildium_property_id IS NOT NULL
    OR buildium_unit_id IS NOT NULL
    OR buildium_lease_id IS NOT NULL
  );

-- Set account_entity_type to 'Company' for lines not linked to properties/units/leases
UPDATE public.transaction_lines
SET account_entity_type = 'Company'::public.entity_type_enum
WHERE account_entity_type IS NULL
  AND property_id IS NULL
  AND unit_id IS NULL
  AND lease_id IS NULL
  AND buildium_property_id IS NULL
  AND buildium_unit_id IS NULL
  AND buildium_lease_id IS NULL;

-- Add constraint to ensure account_entity_type is never null going forward
ALTER TABLE public.transaction_lines
  ALTER COLUMN account_entity_type SET DEFAULT 'Rental'::public.entity_type_enum;

-- Add check constraint to prevent NULL values (after backfill)
ALTER TABLE public.transaction_lines
  ADD CONSTRAINT transaction_lines_account_entity_type_not_null 
  CHECK (account_entity_type IS NOT NULL);

comment on constraint transaction_lines_account_entity_type_not_null on public.transaction_lines is
'Ensures account_entity_type is always set to enable proper entity-type filtering in balance calculations';

commit;
```

## Migration 2: Fix gl_account_balance_as_of

See file: `supabase/migrations/20250108000001_fix_balance_entity_type_filtering.sql`

## Migration 3: Fix get_property_financials

See file: `supabase/migrations/20250108000002_fix_get_property_financials_entity_type.sql`

## Migration 4: Fix v_gl_account_balances_as_of

See file: `supabase/migrations/20250108000003_fix_v_gl_account_balances_entity_type.sql`

## Steps to Apply

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to **SQL Editor**

2. **Apply Migration 1** (backfill)
   - Copy the SQL from Migration 1 above
   - Paste into SQL Editor
   - Click **Run**
   - Verify success message

3. **Apply Migration 2**
   - Open `supabase/migrations/20250108000001_fix_balance_entity_type_filtering.sql`
   - Copy entire file content
   - Paste into SQL Editor
   - Click **Run**

4. **Apply Migration 3**
   - Open `supabase/migrations/20250108000002_fix_get_property_financials_entity_type.sql`
   - Copy entire file content
   - Paste into SQL Editor
   - Click **Run**

5. **Apply Migration 4**
   - Open `supabase/migrations/20250108000003_fix_v_gl_account_balances_entity_type.sql`
   - Copy entire file content
   - Paste into SQL Editor
   - Click **Run**

## Verification

After applying all migrations, verify:

```sql
-- Check that all transaction_lines have account_entity_type set
SELECT COUNT(*) FROM transaction_lines WHERE account_entity_type IS NULL;
-- Should return 0

-- Check constraint exists
SELECT conname FROM pg_constraint 
WHERE conname = 'transaction_lines_account_entity_type_not_null';
-- Should return the constraint name
```

## Alternative: Using Supabase CLI

If you have Supabase CLI linked:

```bash
# Link to your project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Apply all pending migrations
npx supabase db push
```

## Troubleshooting

- **Error: "relation already exists"** - Migration may have been partially applied. Check migration status in Dashboard.
- **Error: "constraint already exists"** - Constraint was already added. Safe to skip.
- **Error: "function already exists"** - Function was already updated. Safe to continue.

## Rollback

If you need to rollback, migrations can be reversed, but note:
- The CHECK constraint prevents NULL values, so you'll need to drop it first
- Balance calculations will revert to including all entity types (original bug)
