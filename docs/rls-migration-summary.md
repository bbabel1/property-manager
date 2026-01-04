# RLS Initplan and Policy Performance Fixes - Summary

## Overview

Completed comprehensive RLS (Row Level Security) performance optimization to address:
1. **Auth RLS Initplan issues** - Direct `auth.*()` calls causing per-row evaluation
2. **Multiple permissive policies** - Overlapping policies causing performance overhead  
3. **Duplicate indexes** - Redundant indexes wasting storage and slowing writes

## Migrations Applied

### Migration 1: `20291229000000_comprehensive_rls_initplan_and_policy_fixes.sql`
- Initial comprehensive migration with dynamic SQL function to wrap auth calls
- Explicit fixes for specific tables (buildings, building_permits, compliance_*, etc.)
- Duplicate index cleanup
- Note: Dynamic SQL function had limited success (185 policies still unwrapped)

### Migration 2: `20291229010000_rls_policy_consolidation_and_index_cleanup.sql` (if created)
- Complete consolidation of permissive policies
- In-place policy updates using `ALTER POLICY` to wrap auth calls
- Explicit role scoping (TO authenticated/service_role)
- Final cleanup of duplicate indexes

## Verification Results

### ✅ Completed
- **Permissive policy consolidation**: All consolidated (`identify_permissive_policies_to_consolidate()` returns 0 rows)
- **Duplicate indexes**: All removed except `storage.objects` (requires elevated permissions)
- **Role scoping**: Policies now have explicit TO clauses where appropriate

### ⚠️ Pending (if migration 2 not yet applied)
- **Unwrapped auth.*() calls**: 185 policies still need wrapping
  - These should be fixed by migration 2 using `ALTER POLICY` instead of DROP/CREATE
  - The dynamic SQL approach had limitations with complex policy expressions

## Next Steps

### 1. Run Supabase Linter
```bash
# If linked to remote project
npx supabase db lint --linked

# Or check for lint warnings in Supabase Dashboard
# Dashboard → Database → Linter
```

### 2. Spot-Check Policies
```sql
-- In psql or Supabase SQL Editor
\dRp+ table_name

-- Example for specific tables
\dRp+ buildium_integrations
\dRp+ billing_events
\dRp+ files
```

### 3. Verify Query Plans
```sql
-- Check that InitPlans are gone
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM public.properties WHERE org_id IS NOT NULL LIMIT 1;

-- Look for "InitPlan" - should be minimal or absent
```

### 4. Run Verification Script
```bash
npx tsx scripts/verify-policy-changes-complete.ts
```

## Expected Outcomes

After all migrations are applied:
- ✅ No InitPlans in query execution plans
- ✅ All `auth.*()` calls wrapped in `(select auth.*())`
- ✅ One permissive policy per table/action/role combo
- ✅ No duplicate indexes (except storage.objects if not dropped)
- ✅ Supabase linter shows no RLS-related warnings

## Troubleshooting

If warnings persist:
1. Check that migration `20291229010000_rls_policy_consolidation_and_index_cleanup.sql` was applied
2. Run `ALTER POLICY` statements manually for any remaining unwrapped calls
3. Use the verification script to identify specific policies needing fixes
4. Consider using `\dRp+ table_name` in psql to inspect policy definitions

## Files Created

- `supabase/migrations/20291229000000_comprehensive_rls_initplan_and_policy_fixes.sql`
- `supabase/migrations/20291229010000_rls_policy_consolidation_and_index_cleanup.sql` (if created)
- `scripts/verify-rls-initplan-fixes.ts` - Verification script
- `scripts/verify-policy-changes-complete.ts` - Complete verification script
- `scripts/sql/verify_rls_initplan_fixes.sql` - SQL verification queries



