-- Deprecated schema patch: fix generate_display_name function search_path
-- and definition via ad-hoc DROP/CREATE.
--
-- Phase 1 single-source-of-truth goal:
--   Only Supabase migrations under supabase/migrations/ should change
--   function definitions and search_path configuration.
--
-- Search path and function hardening (including generate_display_name)
-- is now handled in migrations, notably:
--   - supabase/migrations/20291225000004_secure_search_path_and_permissions.sql
--
-- This file is retained for historical reference and quick verification
-- only; it MUST NOT be used to apply schema changes.
--
-- Read-only verification: check generate_display_name search_path.
SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) AS c
      WHERE c LIKE 'search_path=%'
    ) THEN 'Has search_path'
    ELSE 'Missing search_path'
  END AS search_path_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'generate_display_name'
ORDER BY p.oid;

