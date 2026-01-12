-- Deprecated schema patch: generic “fix insecure RLS policies” helper.
--
-- Phase 1 single-source-of-truth goal:
--   Only Supabase migrations under supabase/migrations/ should add/drop
--   RLS policies. Ad-hoc scripts like this must not mutate schema.
--
-- RLS consolidation and hardening is now handled via the RLS/auth-focused
-- migrations (for example:
--   - 20250911090000_061_integrity_enforcements.sql
--   - 20291229000000_comprehensive_rls_initplan_and_policy_fixes.sql
--   - 20291229010000_rls_policy_consolidation_and_index_cleanup.sql
-- and related files).
--
-- This script is retained as a verification helper only and MUST NOT be
-- used to apply schema changes.
--
-- Read-only verification: spot-check for permissive “true” policies on
-- selected tables.
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'properties', 'units', 'owners', 'staff', 'lease',
    'appliances', 'inspections', 'journal_entries',
    'rent_schedules', 'transactions'
  )
  AND (
    qual ILIKE '%USING (true)%'
    OR with_check ILIKE '%WITH CHECK (true)%'
  )
ORDER BY tablename, policyname;

