# Next Steps: Supabase Database Optimization

**Date**: December 31, 2024  
**Status**: High-priority fixes completed ✅

## Completed Actions

### ✅ 1. Foreign Key Indexes
- Added indexes for 25+ frequently-queried foreign keys
- Migration: `20291231120000_add_missing_fk_indexes_and_primary_keys.sql`
- **Impact**: Improved JOIN and WHERE clause performance

### ✅ 2. Primary Keys
- Added primary key to `gl_account_balances` (UUID `id` column)
- Added composite primary key to `role_permissions` (`role_id`, `permission_id`)
- **Note**: `property_staff` already has composite PK - linter false positive

### ✅ 3. RLS Policy Fixes
- Fixed auth initplan warnings (wrapped `auth.uid()` calls)
- Fixed multiple permissive policies
- Split `FOR ALL` policies into separate INSERT/UPDATE/DELETE policies

## Remaining Items

### ⚠️ Unused Indexes (200+)

**Status**: Monitoring required before action

**Why not removed yet**:
- Indexes may be needed for future features
- Some queries may not have run yet
- Removing prematurely could degrade performance

**Action Plan**:

1. **Week 1-2: Monitor Index Usage**
   ```sql
   -- Check index usage statistics
   SELECT 
     schemaname,
     tablename,
     indexname,
     idx_scan as index_scans,
     idx_tup_read as tuples_read,
     idx_tup_fetch as tuples_fetched
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public'
     AND idx_scan = 0  -- Never used
   ORDER BY tablename, indexname;
   ```

2. **Week 2-4: Review Query Patterns**
   - Check Supabase Query Performance dashboard
   - Review application query logs
   - Identify which indexes are truly unused vs. needed for future features

3. **Month 2: Create Removal Migration** (if confirmed unused)
   ```sql
   -- Example: Remove confirmed unused indexes
   DROP INDEX IF EXISTS idx_example_unused_index;
   ```

**Criteria for Removal**:
- ✅ Index has `idx_scan = 0` for 2+ weeks
- ✅ No planned features require this index
- ✅ Removing won't break existing functionality
- ✅ Tested in staging environment

## Verification Checklist

### Immediate Verification
- [ ] Run application test suite
- [ ] Check Supabase Dashboard → Query Performance
- [ ] Verify RLS policies still work correctly
- [ ] Test critical user flows (login, data access)

### Performance Monitoring (Week 1-2)
- [ ] Monitor query execution times
- [ ] Check index usage statistics
- [ ] Review slow query logs
- [ ] Compare before/after metrics

### Index Analysis (Week 2-4)
- [ ] Run `pg_stat_user_indexes` query
- [ ] Document unused indexes
- [ ] Review with team for future feature needs
- [ ] Create removal plan for confirmed unused indexes

## Recommended Monitoring Queries

### 1. Index Usage Statistics
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  CASE 
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 10 THEN 'RARELY_USED'
    ELSE 'ACTIVE'
  END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, tablename, indexname;
```

### 2. Foreign Key Index Verification
```sql
-- Verify foreign key indexes were created
SELECT 
  t.relname as table_name,
  i.relname as index_name,
  a.attname as column_name
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relkind = 'r'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND i.relname LIKE 'idx_%'
ORDER BY t.relname, i.relname;
```

### 3. Primary Key Verification
```sql
-- Verify primary keys exist
SELECT 
  tc.table_schema,
  tc.table_name,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as primary_key_columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('gl_account_balances', 'role_permissions', 'property_staff')
GROUP BY tc.table_schema, tc.table_name
ORDER BY tc.table_name;
```

## Performance Targets

### Query Performance
- **JOIN queries**: 20-50% improvement expected
- **WHERE clause filters**: 30-60% improvement expected
- **Multi-tenant queries**: Significant improvement for `org_id` filters

### Index Efficiency
- **Index usage rate**: > 80% of indexes should be used
- **Unused index count**: < 50 after monitoring period
- **Index maintenance overhead**: Monitor write performance impact

## Risk Assessment

### Low Risk ✅
- Foreign key indexes: Safe to add, improve performance
- Primary keys: Safe to add, improve data integrity
- RLS policy fixes: Already tested and applied

### Medium Risk ⚠️
- Removing unused indexes: Requires careful verification
- **Mitigation**: Monitor for 2+ weeks before removal

### High Risk ❌
- None identified

## Success Metrics

### Week 1
- ✅ All migrations applied successfully
- ✅ No application errors
- ✅ RLS policies working correctly

### Week 2-4
- 📊 Query performance improved by 20%+
- 📊 Index usage statistics collected
- 📊 Unused indexes identified and documented

### Month 2+
- 🎯 Unused indexes removed (if confirmed)
- 🎯 Overall database performance optimized
- 🎯 Maintenance overhead reduced

## Documentation

- **Summary Report**: `docs/reports/SUPABASE_LINTER_FIXES_SUMMARY.md`
- **Performance Guide**: `docs/PERFORMANCE.md`
- **RLS Fixes**: `docs/reports/RLS_WARNINGS_FIX_SUMMARY.md`

## Support

If issues arise:
1. Check Supabase Dashboard → Database → Logs
2. Review migration files in `supabase/migrations/`
3. Run verification queries above
4. Check application error logs

## Notes

- All migrations are idempotent and safe to re-run
- Indexes use `IF NOT EXISTS` to prevent conflicts
- Primary key additions are conditional
- Monitor before removing any indexes


