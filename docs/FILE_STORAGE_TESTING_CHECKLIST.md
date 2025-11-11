# File Storage Consolidation - Testing Checklist

## Pre-Migration Testing

### 1. Backup Database

- [ ] Create database backup before applying migration
- [ ] Verify backup can be restored

### 2. Migration Application

- [ ] Run `npx supabase db push` to apply migration
- [ ] Verify migration completes without errors
- [ ] Check that `file_categories` table exists
- [ ] Check that new `files` table exists
- [ ] Verify `file_links` table is dropped
- [ ] Verify views `task_history_files` and `work_order_files` are dropped

## Post-Migration Testing

### 3. Database Schema Verification

- [ ] Verify `entity_type_enum` type exists with correct values
- [ ] Verify RLS policies are enabled on both tables
- [ ] Verify indexes are created correctly
- [ ] Check `updated_at` triggers are active

### 4. File Categories Sync

- [ ] Run `npx tsx scripts/buildium/sync/sync-file-categories.ts`
- [ ] Verify categories are created in `file_categories` table
- [ ] Check that `buildium_category_id` is populated correctly
- [ ] Verify org_id scoping works correctly

### 5. File Upload Flow

- [ ] Test `/api/files/upload` with a lease entity
  - Verify file is created with correct `entity_type` and `entity_id`
  - Check that `buildium_lease_id` is resolved correctly
  - Verify file appears in lease documents
- [ ] Test `/api/files/upload` with a bill entity
  - Verify file is created with Vendor entity type (if vendor exists)
  - Check Buildium sync works for bills
- [ ] Test `/api/files/upload` with a property entity
  - Verify file uses Rental entity type
  - Check entity_id matches buildium_property_id
  - Confirm Buildium upload request succeeds and `buildium_file_id`/`buildium_href` are stored
- [ ] Test `/api/files/upload` with unit/tenant/owner/vendor entities that have Buildium IDs
  - Ensure helper resolves Buildium entity type + ID correctly
  - Confirm file is pushed to Buildium and local record captures the returned Buildium file metadata
- [ ] Test `/api/files/{id}/sharing` updates for Buildium-synced files
  - Toggling tenant sharing sends the correct scope for the file's `entity_type`
  - Toggling owner sharing sends the correct scope for the file's `entity_type`
  - Unsynced files (no `buildium_file_id`) keep sharing controls disabled

### 6. File Retrieval

- [ ] Test `/api/files?entityType=Lease&entityId={buildium_lease_id}&orgId={org_id}`
  - Verify files are returned correctly
  - Check filtering by entity works
- [ ] Test `/api/files?entityType=Rental&entityId={buildium_property_id}&orgId={org_id}`
  - Verify property files are returned

### 7. File Presigning

- [ ] Test `/api/bills/[id]/files/[fileId]/presign`
  - Verify presigned URL is generated
  - Check that file lookup uses new schema
- [ ] Test `/api/leases/[id]/documents/[docId]/presign`
  - Verify presigned URL works for lease documents
  - Check entity_type='Lease' and entity_id=buildium_lease_id lookup

### 8. Buildium File Upload Request

- [ ] Test `/api/buildium/files/uploadrequests` POST
  - Verify upload request is created
  - Check response includes BucketUrl and FormData
  - Verify file can be uploaded to returned URL

### 9. Frontend Integration

- [ ] Test lease details page loads files correctly
  - Verify `getFilesByEntity` is called with correct parameters
  - Check file list displays properly
- [ ] Test bill details page file attachments
  - Verify files are fetched correctly
  - Check file display works

### 10. File Category Management

- [ ] Test `/api/buildium/file-categories` GET
  - Verify categories are fetched from Buildium
  - Test with `sync=true` query parameter (if org_id available)
- [ ] Verify category lookup in file upload works
  - Upload file with category name
  - Check `buildium_category_id` is resolved correctly

### 11. RLS Policy Testing

- [ ] Test file access across different organizations
  - Verify users can only see files from their org
  - Check that files from other orgs are filtered out
- [ ] Test file category access
  - Verify org-scoped category access works

### 12. Edge Cases

- [ ] Test file upload with entity that has no Buildium ID
  - Verify fallback to PublicAsset entity type
  - Check entity_id=0 is used
- [ ] Test file upload with invalid category
  - Verify null buildium_category_id when category not found
- [ ] Test file deletion (soft delete)
  - Verify `deleted_at` is set
  - Check deleted files don't appear in queries

### 13. Buildium Sync Scripts

- [ ] Test `scripts/buildium/sync/sync-files-for-entity.ts`
  - Verify files are synced for specific entity
  - Check that existing files are updated, not duplicated
- [ ] Verify sync handles missing Buildium IDs gracefully

### 14. Error Handling

- [ ] Test file upload with missing required fields
- [ ] Test file retrieval with invalid entity type
- [ ] Test file presign with non-existent file
- [ ] Verify error messages are clear and actionable

## Rollback Testing (If Needed)

### 15. Rollback Verification

- [ ] Document rollback steps (restore from backup)
- [ ] Test that application functions with old schema
- [ ] Verify data integrity after rollback

## Performance Testing

### 16. Query Performance

- [ ] Verify entity lookup queries are fast (check index usage)
- [ ] Test file listing with large numbers of files
- [ ] Check that org_id filtering is efficient

## Documentation Verification

### 17. Documentation Updates

- [ ] Verify `docs/database/DATABASE_SCHEMA.md` updated
- [ ] Check `docs/BUILDIUM_API_QUICK_REFERENCE.md` has file upload info
- [ ] Confirm API documentation reflects new schema

## Notes

- All file associations now use direct `entity_type` + `entity_id` pattern
- Entity IDs must be Buildium IDs (integers), not local UUIDs
- File categories are synced from Buildium and cached locally
- RLS policies ensure org-level isolation
- Soft deletes are supported via `deleted_at` column
