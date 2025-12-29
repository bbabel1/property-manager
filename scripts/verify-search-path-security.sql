-- Verification script for search_path and materialized view security fixes
-- Run this to verify the migration was applied successfully

-- 1. Check that functions have search_path set
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) AS c
      WHERE c LIKE 'search_path=%'
    ) THEN '✓ Has search_path'
    ELSE '✗ Missing search_path'
  END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    '_parse_bool',
    '_parse_date',
    '_parse_timestamptz',
    'acquire_compliance_lock',
    'auto_enable_compliance_programs_for_new_org',
    'check_compliance_org_consistency',
    'clear_expired_buildium_cache',
    'ensure_public_ids',
    'enforce_same_org',
    'enforce_service_assignment_mode',
    'find_duplicate_buildium_ids',
    'find_duplicate_ownerships',
    'find_duplicate_units',
    'fn_calculate_transaction_total',
    'fn_create_lease_aggregate',
    'fn_create_lease_full',
    'fn_sync_lease_document_to_files',
    'fn_sync_transaction_total',
    'fn_sync_units_address_on_property_update',
    'fn_transactions_enforce_total',
    'force_public_id_on_insert',
    'generate_public_id',
    'get_buildium_api_cache',
    'get_foreign_keys',
    'get_my_claims',
    'get_property_financials',
    'get_table_columns',
    'get_table_stats',
    'gl_account_activity',
    'gl_ledger_balance_as_of',
    'gl_trial_balance_as_of',
    'handle_calendar_integration_staff_deactivation',
    'handle_lease_payment_webhook',
    'handle_new_user',
    'handle_owner_webhook_update',
    'handle_property_webhook_update',
    'handle_staff_deactivation',
    'handle_task_status_webhook',
    'handle_unit_webhook_update',
    'is_platform_admin',
    'is_valid_country',
    'jwt_custom_claims',
    'lease_contacts_org_guard',
    'map_bill_to_buildium',
    'map_event_status_to_item_status',
    'map_owner_to_buildium',
    'map_property_to_buildium',
    'map_task_to_buildium',
    'map_unit_to_buildium',
    'map_vendor_to_buildium',
    'map_work_order_to_buildium',
    'normalize_country',
    'ownerships_org_guard',
    'prevent_email_template_key_change',
    'prevent_public_id_update',
    'process_buildium_webhook_event',
    'reconcile_monthly_log_balance',
    'reconciliation_log_sync_as_of',
    'refresh_schema_cache',
    'release_compliance_lock',
    'resolve_compliance_program',
    'set_buildium_api_cache',
    'set_buildium_property_id',
    'set_data_sources_updated_at',
    'set_email_template_created_by',
    'set_email_template_updated_by',
    'set_org_memberships_updated_at',
    'set_organizations_updated_at',
    'set_updated_at',
    'sync_organization_name',
    'trigger_update_owner_total_fields',
    'trigger_update_ownerships_from_properties',
    'trigger_update_property_unit_counts',
    'trg_normalize_transaction_line',
    'trg_recalc_balance_on_stage_update',
    'trg_set_previous_balance',
    'trg_validate_ownership_totals',
    'trg_validate_transaction_balance',
    'units_org_guard',
    'update_buildium_sync_status',
    'update_property_unit_counts',
    'update_rent_schedules_updated_at',
    'update_updated_at_column',
    'validate_ownership_totals',
    'work_orders_org_guard',
    'v_gl_account_balances_as_of'
  )
  AND p.prokind = 'f'
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

-- 2. Check materialized view permissions
SELECT 
  schemaname,
  matviewname,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'v_service_revenue_by_property',
    'v_service_revenue_by_unit',
    'table_info_cache',
    'column_info_cache',
    'v_service_revenue_by_owner',
    'v_service_revenue_by_offering',
    'v_service_costs',
    'v_service_profitability'
  )
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY matviewname, grantee, privilege_type;

-- 3. Check extensions schema exists and btree_gist is moved (if it exists)
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') 
    THEN '✓ extensions schema exists'
    ELSE '✗ extensions schema missing'
  END as extensions_schema_status;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM pg_extension e
          JOIN pg_namespace n ON n.oid = e.extnamespace
          WHERE e.extname = 'btree_gist' AND n.nspname = 'extensions'
        ) THEN '✓ btree_gist is in extensions schema'
        ELSE '✗ btree_gist is not in extensions schema'
      END
    ELSE 'btree_gist extension not installed'
  END as btree_gist_status;
