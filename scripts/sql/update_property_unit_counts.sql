-- Deprecated schema patch: update_property_unit_counts function and trigger.
--
-- Phase 1 single-source-of-truth goal:
--   Only Supabase migrations under supabase/migrations/ should define
--   functions/triggers that maintain property unit counts.
--
-- The canonical implementation of update_property_unit_counts() and
-- trigger_update_property_unit_counts() now lives in migrations:
--   - 20250103000000_016_fix_property_unit_counts.sql
--   - 20250103000001_017_remove_vacant_units_count.sql
--
-- This file is retained for historical context and MUST NOT be used to
-- apply schema changes. To evolve this behavior, add a new migration.
--
-- Read-only verification: confirm the functions exist.
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('update_property_unit_counts', 'trigger_update_property_unit_counts')
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

