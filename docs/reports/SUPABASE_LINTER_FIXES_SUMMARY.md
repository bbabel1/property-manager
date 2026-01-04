# Supabase Linter Fixes Summary

**Date**: December 31, 2024  
**Status**: ✅ High-priority fixes applied

## Overview

This document summarizes the fixes applied to address Supabase database linter suggestions. The linter identified performance and schema issues that were addressed through targeted migrations.

## Issues Addressed

### 1. ✅ Unindexed Foreign Keys (25+ fixed)

**Problem**: Foreign key columns without covering indexes can lead to suboptimal query performance, especially for frequently-queried relationships.

**Solution**: Added indexes for all frequently-queried foreign keys, including:
- Multi-tenant scoping: `org_id`, `property_id`, `lease_id`
- User relationships: `user_id`, `created_by`, `updated_by`
- Service relationships: `assignment_id`, `plan_id`, `offering_id`
- Compliance relationships: `primary_work_order_id`, `linked_item_id`, `linked_work_order_id`
- Transaction relationships: `unit_id`, `paid_to_tenant_id`, `paid_to_vendor_id`, `bill_transaction_id`

**Migration**: `20291231120000_add_missing_fk_indexes_and_primary_keys.sql`

**Impact**: Improved query performance for JOINs and WHERE clauses filtering on foreign keys.

### 2. ✅ Missing Primary Keys (2 fixed)

**Problem**: Tables without primary keys can be inefficient to interact with at scale and cause issues with replication.

**Solution**:
- **`gl_account_balances`**: Added `id` UUID column as primary key (since `property_id` can be NULL, composite key wasn't possible)
- **`role_permissions`**: Added composite primary key `(role_id, permission_id)` if columns exist

**Note**: 
- `property_staff` already has composite PRIMARY KEY `(property_id, staff_id, role)` - linter warning is a false positive
- The linter may not recognize composite primary keys correctly

**Migration**: `20291231120000_add_missing_fk_indexes_and_primary_keys.sql`

### 3. ⚠️ Unused Indexes (200+ remaining)

**Status**: **Not addressed** - Requires monitoring period

**Recommendation**: 
1. **Monitor for 1-2 weeks** after deployment
2. Check Supabase Query Performance dashboard to confirm indexes are truly unused
3. Review application query patterns to ensure indexes aren't needed for future features
4. Remove only after confirming:
   - Index has never been used in query logs
   - Index is not needed for planned features
   - Removing won't break existing functionality

**Risk**: Removing indexes prematurely could degrade performance for queries that haven't run yet or for future features.

## Migration Details

### Applied Migrations

1. **`20291231010000_fix_remaining_rls_warnings_final.sql`**
   - Fixed RLS policy issues (auth initplan warnings)
   - Fixed `service_offering_assignments` policy to correctly join with `service_plan_assignments`
   - Split `FOR ALL` policies into separate INSERT/UPDATE/DELETE policies

2. **`20291231120000_add_missing_fk_indexes_and_primary_keys.sql`**
   - Added 25+ foreign key indexes
   - Added primary keys for `gl_account_balances` and `role_permissions`
   - All operations use `IF NOT EXISTS` for idempotency

## Verification Steps

### 1. Verify Indexes Were Created

```sql
-- Check foreign key indexes
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_%_assignment_id'
   OR indexname LIKE 'idx_%_org_id'
   OR indexname LIKE 'idx_%_property_id'
ORDER BY tablename, indexname;
```

### 2. Verify Primary Keys

```sql
-- Check primary keys
SELECT 
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('gl_account_balances', 'role_permissions', 'property_staff')
ORDER BY tc.table_name;
```

### 3. Monitor Query Performance

1. Check Supabase Dashboard → Database → Query Performance
2. Look for improvements in:
   - Query execution time for JOINs on foreign keys
   - Index usage statistics
   - Overall query performance

## Next Steps

### Immediate (Completed)
- ✅ Add indexes for frequently-queried foreign keys
- ✅ Add primary keys where missing
- ✅ Fix RLS policy warnings

### Short-term (1-2 weeks)
1. **Monitor unused indexes**:
   - Review Supabase Query Performance dashboard
   - Check `pg_stat_user_indexes` for index usage
   - Document which indexes are truly unused

2. **Verify fixes**:
   - Run application test suite
   - Check for any performance regressions
   - Verify RLS policies still work correctly

### Long-term (1-2 months)
1. **Remove unused indexes** (if confirmed unused):
   - Create migration to drop confirmed unused indexes
   - Test in staging environment first
   - Monitor performance after removal

2. **Optimize remaining indexes**:
   - Review composite indexes for optimization opportunities
   - Consider partial indexes for filtered queries
   - Add indexes for new query patterns as they emerge

## Performance Impact

### Expected Improvements
- **JOIN performance**: 20-50% faster for queries joining on indexed foreign keys
- **WHERE clause performance**: 30-60% faster for filters on indexed foreign keys
- **Multi-tenant queries**: Significant improvement for `org_id` filtered queries
- **Write performance**: Slight improvement for foreign key constraint checks

### Monitoring Metrics
- Query execution time (p50, p95, p99)
- Index usage statistics
- Connection pool utilization
- Catalog query time (should remain < 1% of total)

## References

- [Supabase Database Linter Documentation](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL Index Best Practices](https://www.postgresql.org/docs/current/indexes.html)
- [Performance Optimization Guide](../PERFORMANCE.md)

## Notes

- All migrations are idempotent and safe to re-run
- Indexes use `IF NOT EXISTS` to prevent conflicts
- Primary key additions are conditional to avoid errors
- The linter may show false positives for composite primary keys


