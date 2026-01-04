-- Verification script for security fixes
-- Run this to verify that views are security invoker and RLS is enabled

-- 1. Check view security settings (PostgreSQL 15+)
-- Note: This query may not work on older PostgreSQL versions
SELECT 
  schemaname,
  viewname,
  CASE 
    WHEN (SELECT reloptions FROM pg_class WHERE relname = viewname AND relkind = 'v') IS NULL THEN 'default (security_definer)'
    WHEN array_to_string((SELECT reloptions FROM pg_class WHERE relname = viewname AND relkind = 'v'), ',') LIKE '%security_invoker%' THEN 'security_invoker'
    ELSE 'security_definer'
  END as security_type
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname IN (
    'v_reconciliation_variance_alerts',
    'v_rent_roll_current_month',
    'v_dashboard_kpis',
    'v_recent_transactions_ranked',
    'user_profiles',
    'v_rent_roll_previous_month',
    'v_bank_register_transactions',
    'v_reconciliation_variances',
    'v_active_work_orders_ranked',
    'v_lease_renewals_summary'
  )
ORDER BY viewname;

-- 2. Check RLS status on tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'unit_images',
    'unit_notes',
    'property_notes',
    'lease_notes',
    'lease_recurring_transactions',
    'recurring_transactions',
    'journal_entries',
    'statement_emails',
    'idempotency_keys',
    'webhook_event_flags',
    'gl_import_cursors',
    'transaction_type_sign',
    'gl_account_category',
    'device_type_normalization',
    'data_sources',
    'permissions'
  )
ORDER BY tablename;

-- 3. Check that policies exist
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
    'unit_images',
    'unit_notes',
    'property_notes',
    'lease_notes',
    'lease_recurring_transactions',
    'recurring_transactions',
    'journal_entries',
    'statement_emails',
    'idempotency_keys',
    'webhook_event_flags',
    'gl_import_cursors',
    'transaction_type_sign',
    'gl_account_category',
    'device_type_normalization',
    'data_sources',
    'permissions'
  )
ORDER BY tablename, policyname;

-- 4. Count policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN (
    'unit_images',
    'unit_notes',
    'property_notes',
    'lease_notes',
    'lease_recurring_transactions',
    'recurring_transactions',
    'journal_entries',
    'statement_emails',
    'idempotency_keys',
    'webhook_event_flags',
    'gl_import_cursors',
    'transaction_type_sign',
    'gl_account_category',
    'device_type_normalization',
    'data_sources',
    'permissions'
  )
GROUP BY tablename
ORDER BY tablename;

