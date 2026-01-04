-- Verification Script for RLS Initplan and Policy Performance Fixes
-- Run this after applying migration 20291229000000_comprehensive_rls_initplan_and_policy_fixes.sql
--
-- This script checks:
-- 1. That initplans are gone from query plans (auth.*() calls wrapped in subselects)
-- 2. That policies still work correctly
-- 3. That duplicate indexes are gone

-- ============================================================================
-- PART 1: Check for Initplans in Query Plans
-- ============================================================================

\echo '================================================================================'
\echo 'PART 1: Checking for Initplans in Query Plans'
\echo '================================================================================'
\echo ''
\echo 'Running EXPLAIN on representative queries to verify initplans are gone...'
\echo ''

-- Test 1: Properties table (common org-scoped table)
\echo 'Test 1: Properties SELECT query'
\echo '----------------------------------------------------------------------'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, name, org_id
FROM public.properties
WHERE org_id IS NOT NULL
LIMIT 10;

\echo ''
\echo 'Look for "InitPlan" in the output above - it should be minimal or absent'
\echo ''

-- Test 2: Units table
\echo 'Test 2: Units SELECT query'
\echo '----------------------------------------------------------------------'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, property_id, unit_number
FROM public.units
WHERE property_id IS NOT NULL
LIMIT 10;

\echo ''
\echo 'Look for "InitPlan" in the output above - it should be minimal or absent'
\echo ''

-- Test 3: Work orders table
\echo 'Test 3: Work Orders SELECT query'
\echo '----------------------------------------------------------------------'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, title, org_id
FROM public.work_orders
WHERE org_id IS NOT NULL
LIMIT 10;

\echo ''
\echo 'Look for "InitPlan" in the output above - it should be minimal or absent'
\echo ''

-- Test 4: Bank accounts (if table exists)
\echo 'Test 4: Bank Accounts SELECT query'
\echo '----------------------------------------------------------------------'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, name, org_id
FROM public.bank_accounts
WHERE org_id IS NOT NULL
LIMIT 10;

\echo ''
\echo 'Look for "InitPlan" in the output above - it should be minimal or absent'
\echo ''

-- Test 5: Transactions (if table exists)
\echo 'Test 5: Transactions SELECT query'
\echo '----------------------------------------------------------------------'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, amount, org_id
FROM public.transactions
WHERE org_id IS NOT NULL
LIMIT 10;

\echo ''
\echo '================================================================================'
\echo 'PART 2: Check for Remaining Direct auth.*() Calls in Policies'
\echo '================================================================================'
\echo ''
\echo 'Checking policies for remaining direct auth.*() calls (should be wrapped in subselects)...'
\echo ''

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%' THEN 'DIRECT auth.uid() FOUND'
    WHEN qual LIKE '%auth.role()%' AND qual NOT LIKE '%(select auth.role())%' THEN 'DIRECT auth.role() FOUND'
    WHEN qual LIKE '%auth.jwt()%' AND qual NOT LIKE '%(select auth.jwt())%' THEN 'DIRECT auth.jwt() FOUND'
    WHEN qual LIKE '%current_setting(%' AND qual NOT LIKE '%(select current_setting%' THEN 'DIRECT current_setting() FOUND'
    ELSE 'OK'
  END as using_status,
  CASE 
    WHEN with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%' THEN 'DIRECT auth.uid() FOUND'
    WHEN with_check LIKE '%auth.role()%' AND with_check NOT LIKE '%(select auth.role())%' THEN 'DIRECT auth.role() FOUND'
    WHEN with_check LIKE '%auth.jwt()%' AND with_check NOT LIKE '%(select auth.jwt())%' THEN 'DIRECT auth.jwt() FOUND'
    WHEN with_check LIKE '%current_setting(%' AND with_check NOT LIKE '%(select current_setting%' THEN 'DIRECT current_setting() FOUND'
    ELSE 'OK'
  END as with_check_status
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (qual LIKE '%auth.%()%' AND qual NOT LIKE '%(select auth.%')
    OR (with_check LIKE '%auth.%()%' AND with_check NOT LIKE '%(select auth.%')
    OR (qual LIKE '%current_setting(%' AND qual NOT LIKE '%(select current_setting%')
    OR (with_check LIKE '%current_setting(%' AND with_check NOT LIKE '%(select current_setting%')
  )
ORDER BY tablename, policyname;

\echo ''
\echo 'Any rows returned above indicate policies that still need fixing'
\echo ''

-- ============================================================================
-- PART 3: Check for Duplicate Indexes
-- ============================================================================

\echo '================================================================================'
\echo 'PART 3: Checking for Duplicate Indexes'
\echo '================================================================================'
\echo ''
\echo 'Checking for duplicate indexes that should have been dropped...'
\echo ''

-- Check for duplicate indexes on billing_events
\echo 'billing_events indexes:'
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'billing_events'
  AND indexname IN ('idx_billing_events_org_period', 'idx_service_revenue_org_period')
ORDER BY indexname;

\echo ''
\echo 'Should only see idx_billing_events_org_period (idx_service_revenue_org_period should be gone)'
\echo ''

-- Check for duplicate indexes on buildium_webhook_events
\echo 'buildium_webhook_events unique constraints/indexes on event_id:'
SELECT 
  c.conname as constraint_name,
  i.indexname as index_name,
  c.contype as constraint_type
FROM pg_constraint c
FULL OUTER JOIN pg_indexes i ON i.indexname = c.conname
WHERE (c.conrelid = 'public.buildium_webhook_events'::regclass OR i.tablename = 'buildium_webhook_events')
  AND schemaname = 'public'
  AND (c.conname LIKE '%event_id%' OR i.indexname LIKE '%event_id%')
ORDER BY constraint_name, index_name;

\echo ''
\echo 'Should not see buildium_webhook_events_event_id_key or uq_buildium_webhook_events_event_id'
\echo ''

-- Check for duplicate indexes on membership_roles
\echo 'membership_roles indexes:'
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'membership_roles'
  AND (
    indexname LIKE '%user_permission_profiles%'
    OR indexname LIKE '%membership_roles%'
  )
ORDER BY indexname;

\echo ''
\echo 'Should not see user_permission_profiles_* indexes'
\echo ''

-- Check for duplicate indexes on transaction_lines
\echo 'transaction_lines indexes (should not see duplicates):'
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'transaction_lines'
  AND (
    indexname IN (
      'idx_journal_entries_gl_account_id',
      'idx_tx_lines_gl',
      'idx_transaction_lines_lease_id',
      'idx_tx_lines_lease',
      'idx_tx_lines_property_date',
      'tl_prop_date_idx',
      'idx_journal_entries_transaction_id',
      'idx_tx_lines_transaction_id',
      'idx_transaction_lines_unit_id',
      'idx_tx_lines_unit'
    )
  )
ORDER BY indexname;

\echo ''
\echo 'Should only see one of each pair (idx_tx_lines_* versions, not idx_journal_entries_* or idx_transaction_lines_*)'
\echo 'Should only see tl_prop_date_idx, not idx_tx_lines_property_date'
\echo ''

-- ============================================================================
-- PART 4: Check Multiple Permissive Policies
-- ============================================================================

\echo '================================================================================'
\echo 'PART 4: Checking for Multiple Permissive Policies'
\echo '================================================================================'
\echo ''
\echo 'Tables with multiple permissive policies per action (should be consolidated)...'
\echo ''

SELECT 
  tablename,
  cmd,
  COUNT(*) as policy_count,
  array_agg(policyname ORDER BY policyname) as policy_names
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;

\echo ''
\echo 'Any rows returned above indicate tables that may benefit from policy consolidation'
\echo ''

-- ============================================================================
-- PART 5: Summary
-- ============================================================================

\echo '================================================================================'
\echo 'VERIFICATION SUMMARY'
\echo '================================================================================'
\echo ''
\echo 'Review the output above to verify:'
\echo '  1. EXPLAIN plans show minimal or no InitPlans'
\echo '  2. No policies with direct auth.*() calls found (all wrapped in subselects)'
\echo '  3. Duplicate indexes have been removed'
\echo '  4. Multiple permissive policies have been identified (if any remain)'
\echo ''
\echo 'If initplans still appear, check the specific policies for those tables'
\echo 'and ensure all auth.*() calls are wrapped in (select auth.*()) subselects.'
\echo ''



