-- Quick verification script to spot-check RLS policy changes
-- Run with: npx tsx scripts/sql/run-remote-sql.ts scripts/verify-rls-policy-changes.sql
-- Or in Supabase SQL Editor

-- ============================================================================
-- PART 1: Verify auth.*() calls are wrapped in subselects
-- ============================================================================

\echo 'Checking for policies with unwrapped auth.*() calls...'
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%' THEN 'UNWRAPPED auth.uid()'
    WHEN qual LIKE '%auth.role()%' AND qual NOT LIKE '%(select auth.role())%' THEN 'UNWRAPPED auth.role()'
    WHEN qual LIKE '%auth.jwt()%' AND qual NOT LIKE '%(select auth.jwt())%' THEN 'UNWRAPPED auth.jwt()'
    WHEN qual LIKE '%current_setting(%' AND qual NOT LIKE '%(select current_setting%' THEN 'UNWRAPPED current_setting()'
    ELSE 'OK'
  END as issue
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (qual LIKE '%auth.%()%' AND qual NOT LIKE '%(select auth.%')
    OR (qual LIKE '%current_setting(%' AND qual NOT LIKE '%(select current_setting%')
  )
ORDER BY tablename, policyname
LIMIT 20;

\echo ''

-- ============================================================================
-- PART 2: Spot-check specific policies that were updated
-- ============================================================================

\echo 'Spot-checking updated policies...'
\echo ''

\echo 'buildium_integrations_org_read:'
SELECT 
  policyname,
  roles,
  cmd,
  left(qual, 100) as using_clause_preview,
  left(with_check, 100) as with_check_preview
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'buildium_integrations'
  AND policyname = 'buildium_integrations_org_read';

\echo ''
\echo 'billing_events_rw:'
SELECT 
  policyname,
  roles,
  cmd,
  left(qual, 100) as using_clause_preview,
  left(with_check, 100) as with_check_preview
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'billing_events'
  AND policyname = 'billing_events_rw';

\echo ''
\echo 'files_select_org:'
SELECT 
  policyname,
  roles,
  cmd,
  left(qual, 100) as using_clause_preview
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'files'
  AND policyname = 'files_select_org';

\echo ''

-- ============================================================================
-- PART 3: Verify role scoping (TO clauses)
-- ============================================================================

\echo 'Checking policies with explicit role scoping (TO authenticated/service_role)...'
SELECT 
  tablename,
  policyname,
  cmd,
  roles,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND roles IS NOT NULL
  AND array_length(roles, 1) > 0
ORDER BY tablename, policyname
LIMIT 30;

\echo ''
\echo '================================================================================'
\echo 'SUMMARY: If no rows appear in PART 1, all auth.*() calls are properly wrapped'
\echo '================================================================================'




