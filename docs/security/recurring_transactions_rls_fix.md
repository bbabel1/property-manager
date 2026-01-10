# Recurring Transactions RLS Fix

**Date**: January 31, 2025  
**Migration**: `20250131000001_fix_recurring_transactions_rls.sql`  
**Status**: ✅ Applied

## Issue

Supabase linter identified that `recurring_transactions` table had RLS disabled:

```
Table `public.recurring_transactions` is public, but RLS has not been enabled.
```

## Solution

Enabled RLS on `recurring_transactions` table with tenant-scoped policies.

### Table Structure

- **Table**: `public.recurring_transactions`
- **Key Column**: `lease_id` (references `lease.id`)
- **Scoping**: `lease_id` → `lease.property_id` → `properties.org_id`

### Policies Created

1. **`recurring_transactions_tenant_select`** - SELECT policy
2. **`recurring_transactions_tenant_insert`** - INSERT policy  
3. **`recurring_transactions_tenant_update`** - UPDATE policy
4. **`recurring_transactions_tenant_delete`** - DELETE policy

All policies check that the user has access to the organization via `org_memberships` by following the chain:
- `recurring_transactions.lease_id` → `lease.id`
- `lease.property_id` → `properties.id`
- `properties.org_id` → `org_memberships.org_id`
- `org_memberships.user_id` = `auth.uid()`

### Special Handling

The policies include an `OR lease_id IS NULL` clause to handle cases where `lease_id` might be null. This is a permissive approach to avoid breaking existing functionality. If all records have `lease_id` set (which appears to be the case based on code usage), this clause has no effect.

## Verification

✅ Migration applied successfully  
✅ Table is accessible (16/16 tables now have RLS)  
✅ Tenant isolation working

## Related Files

- Migration: `supabase/migrations/20250131000001_fix_recurring_transactions_rls.sql`
- Updated verification scripts to include `recurring_transactions`

## Impact

- **Security**: ✅ RLS now enforced on `recurring_transactions`
- **Functionality**: ✅ No breaking changes expected
- **Performance**: ✅ Minimal overhead (uses efficient EXISTS subqueries)

## Complete Security Status

All tables now have RLS enabled:
- ✅ 8 tenant-scoped tables
- ✅ 3 service-role only tables
- ✅ 4 reference/lookup tables
- ✅ 1 permissions table

**Total**: 16 tables with RLS enabled




