# File Storage Consolidation - Migration Ready Checklist

## ✅ Pre-Migration Verification

### Code Updates Completed

- [x] Migration file created with correct table references (`organizations` not `orgs`)
- [x] All API routes updated to remove `file_links` references
- [x] All components updated to use new schema
- [x] TypeScript types updated
- [x] Buildium schemas updated
- [x] Documentation updated

### Files Ready for Migration

- [x] Migration file: `supabase/migrations/20251103000000_143_consolidate_file_storage.sql`
- [x] All code references updated
- [x] No remaining `file_links` table usage
- [x] Component compatibility maintained

## 🚀 Migration Steps

### 1. Database Backup (CRITICAL)

```bash
# Create backup before migration
npx supabase db dump -f backup_before_file_consolidation.sql
```

### 2. Apply Migration

```bash
# Push migration to database
npx supabase db push

# Or apply specific migration
npx supabase migration up --target 20251103000000_143_consolidate_file_storage
```

### 3. Verify Migration Success

```sql
-- Check that new tables exist
SELECT * FROM information_schema.tables
WHERE table_name IN ('file_categories', 'files');

-- Check that old tables are gone
SELECT * FROM information_schema.tables
WHERE table_name IN ('file_links');

-- Verify enum type
SELECT * FROM pg_type WHERE typname = 'entity_type_enum';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('file_categories', 'files');
```

### 4. Regenerate TypeScript Types

```bash
# Generate database types
npx supabase gen types typescript --local > src/types/database.ts

# Or for remote database
npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
```

### 5. Sync File Categories from Buildium

```bash
# Run sync script to populate file_categories table
npx tsx scripts/buildium/sync/sync-file-categories.ts
```

### 6. Test Critical Functionality

- [ ] File upload works (lease, bill, property)
- [ ] File retrieval by entity works
- [ ] File presigning works
- [ ] Buildium sync works
- [ ] RLS policies enforce org isolation

### 7. Monitor for Errors

- Check application logs for any file-related errors
- Monitor database for constraint violations
- Verify Buildium API calls succeed

## ⚠️ Important Notes

1. **No Data Migration**: The migration does NOT migrate existing file data. This is intentional - you're starting fresh with the new schema.

2. **Entity IDs**: Files now require Buildium entity IDs (integers), not local UUIDs. Make sure entities have `buildium_*_id` values populated.

3. **Breaking Change**: Any code that still references `file_links` will fail after migration. All code has been updated, but double-check custom integrations.

4. **Rollback**: If you need to rollback:
   ```bash
   # Restore from backup
   psql <your-database-url> < backup_before_file_consolidation.sql
   # Then revert code changes in git
   ```

## 📋 Post-Migration Tasks

1. **Update Frontend**: Ensure all file uploads use new API structure
2. **Test Buildium Integration**: Verify file sync works end-to-end
3. **Monitor Performance**: Check query performance with new indexes
4. **Update Team Documentation**: Share migration notes with team

## 🔍 Verification Queries

```sql
-- Count files by entity type
SELECT entity_type, COUNT(*)
FROM files
WHERE deleted_at IS NULL
GROUP BY entity_type;

-- Check file categories
SELECT * FROM file_categories
ORDER BY created_at DESC
LIMIT 10;

-- Verify org_id scoping
SELECT org_id, COUNT(*)
FROM files
GROUP BY org_id;
```

## Support

If issues arise:

1. Check migration logs: `supabase/migrations/`
2. Review application logs for file-related errors
3. Verify RLS policies allow access
4. Check Buildium API connectivity
