-- Remove duplicate migration file
-- This migration file itself is a no-op; the actual cleanup is removing the file from the filesystem.
-- The duplicate migration 20250201120000_double_entry_validation_functions.sql is identical to
-- 20250201000000_double_entry_validation_functions.sql (confirmed via diff -u).
--
-- Both migrations have already been applied to the database, so removing the later file
-- from the codebase is safe. The database migration history will retain both timestamps,
-- but future deployments will only have the earlier migration file.
--
-- Action: Delete supabase/migrations/20250201120000_double_entry_validation_functions.sql
--        from the filesystem (this is done via git, not SQL).

-- This is a placeholder migration to document the removal.
-- No SQL operations needed since both migrations were already applied.

SELECT 'Duplicate migration removal documented' AS note;

