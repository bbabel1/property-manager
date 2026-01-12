-- Normalize migration version names after renumbering far-future placeholders.
-- This keeps already-applied migrations in sync with the new filenames so Supabase
-- does not attempt to re-run DDL on existing environments.
do $$
declare
  rec record;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'schema_migrations table missing; skipping normalization';
    return;
  end if;

  for rec in
    update supabase_migrations.schema_migrations sm
    set version = m.new_version
    from (
      values
        ('20280401000000_drop_gl_account_bank_id.sql','20270201000000_drop_gl_account_bank_id.sql'),
        ('20280402120000_update_bank_balance_from_transactions.sql','20270201000200_update_bank_balance_from_transactions.sql'),
        ('20280402123000_bank_balance_rls_fix.sql','20270201000400_bank_balance_rls_fix.sql'),
        ('20280402124000_bank_balance_permissions.sql','20270201000600_bank_balance_permissions.sql'),
        ('20280402125000_bank_balance_function_reapply_fix.sql','20270201000800_bank_balance_function_reapply_fix.sql'),
        ('20290115093000_update_v_bank_register_transactions_add_bank_amount.sql','20270201001000_update_v_bank_register_transactions_add_bank_amount.sql'),
        ('20290115100000_update_v_bank_register_transactions_prefer_credit.sql','20270201001200_update_v_bank_register_transactions_prefer_credit.sql'),
        ('20290115103000_update_v_bank_register_transactions_add_payee.sql','20270201001400_update_v_bank_register_transactions_add_payee.sql'),
        ('20290115110000_create_transaction_files.sql','20270201001600_create_transaction_files.sql'),
        ('20290312100000_payment_form_perf_indexes.sql','20270201001800_payment_form_perf_indexes.sql'),
        ('20290415120000_add_gl_account_property_unit_scoping.sql','20270201002000_add_gl_account_property_unit_scoping.sql'),
        ('20290415121000_create_post_transaction_rpc.sql','20270201002200_create_post_transaction_rpc.sql'),
        ('20290415123000_add_transaction_header_scoping.sql','20270201002400_add_transaction_header_scoping.sql'),
        ('20290415130000_add_transaction_locking.sql','20270201002600_add_transaction_locking.sql'),
        ('20290415131500_enhance_journal_entries.sql','20270201002800_enhance_journal_entries.sql'),
        ('20290415134500_extend_gl_reporting.sql','20270201003000_extend_gl_reporting.sql'),
        ('20290415140000_update_get_property_financials_scope.sql','20270201003200_update_get_property_financials_scope.sql'),
        ('20291224090000_update_v_bank_register_transactions_add_transfer_flags.sql','20270201003400_update_v_bank_register_transactions_add_transfer_flags.sql'),
        ('20291225000000_cleanup_unused_schema.sql','20270201003600_cleanup_unused_schema.sql'),
        ('20291225000001_remove_duplicate_migration.sql','20270201003800_remove_duplicate_migration.sql'),
        ('20291225000002_audit_log_retention_policies.sql','20270201004000_audit_log_retention_policies.sql'),
        ('20291225000003_fix_dashboard_kpis_view.sql','20270201004200_fix_dashboard_kpis_view.sql'),
        ('20291225000004_secure_search_path_and_permissions.sql','20270201004400_secure_search_path_and_permissions.sql'),
        ('20291225000005_harden_remaining_search_paths.sql','20270201004600_harden_remaining_search_paths.sql'),
        ('20291229000000_comprehensive_rls_initplan_and_policy_fixes.sql','20270201004800_comprehensive_rls_initplan_and_policy_fixes.sql'),
        ('20291229010000_rls_policy_consolidation_and_index_cleanup.sql','20270201005000_rls_policy_consolidation_and_index_cleanup.sql'),
        ('20291230000000_fix_supabase_lint_warnings.sql','20270201005200_fix_supabase_lint_warnings.sql'),
        ('20291231000000_fix_remaining_rls_warnings.sql','20270201005400_fix_remaining_rls_warnings.sql'),
        ('20291231010000_fix_remaining_rls_warnings_final.sql','20270201005600_fix_remaining_rls_warnings_final.sql'),
        ('20291231100000_fix_remaining_rls_warnings_final.sql','20270201005800_fix_remaining_rls_warnings_final.sql'),
        ('20291231110000_fix_multiple_permissive_policies.sql','20270201010000_fix_multiple_permissive_policies.sql'),
        ('20291231120000_add_missing_fk_indexes_and_primary_keys.sql','20270201010200_add_missing_fk_indexes_and_primary_keys.sql'),
        ('20291231130000_fix_get_property_financials_scope_shared_bank.sql','20270201010400_fix_get_property_financials_scope_shared_bank.sql'),
        ('20291301090000_create_bank_register_state.sql','20270201010600_create_bank_register_state.sql'),
        ('20291301100000_extend_reconciliation_log.sql','20270201010800_extend_reconciliation_log.sql'),
        ('20291301103000_reconciliation_guardrails.sql','20270201011000_reconciliation_guardrails.sql'),
        ('20291301110000_create_banking_audit_log.sql','20270201011200_create_banking_audit_log.sql'),
        ('20291301113000_reconciliation_sync_tracking.sql','20270201011400_reconciliation_sync_tracking.sql'),
        ('20291301120000_update_v_bank_register_transactions.sql','20270201011600_update_v_bank_register_transactions.sql'),
        ('20291301130000_backfill_bank_register_state.sql','20270201011800_backfill_bank_register_state.sql'),
        ('20291302000000_create_deposit_overlays.sql','20270201012000_create_deposit_overlays.sql'),
        ('20291302010000_deposit_reconciliation_locking.sql','20270201012200_deposit_reconciliation_locking.sql'),
        ('20291302020000_create_udf_warning_views.sql','20270201012400_create_udf_warning_views.sql'),
        ('20291302030000_create_ar_data_model.sql','20270201012600_create_ar_data_model.sql'),
        ('20291302031000_add_charge_proration_link.sql','20270201012800_add_charge_proration_link.sql'),
        ('20291302040000_add_charge_schedules.sql','20270201013000_add_charge_schedules.sql'),
        ('20291302041000_backfill_deposits_from_transactions.sql','20270201013200_backfill_deposits_from_transactions.sql'),
        ('20291302042000_add_nsf_fee_support.sql','20270201013400_add_nsf_fee_support.sql'),
        ('20291302043000_add_org_gl_control_accounts.sql','20270201013600_add_org_gl_control_accounts.sql'),
        ('20291302044000_backfill_charges_from_transactions.sql','20270201013800_backfill_charges_from_transactions.sql'),
        ('20291302045000_create_payment_lifecycle_schema.sql','20270201014000_create_payment_lifecycle_schema.sql'),
        ('20291302050000_foundation_ap_config_org_id_atomic_bills.sql','20270201014200_foundation_ap_config_org_id_atomic_bills.sql'),
        ('20291302051000_create_bill_overlay_tables.sql','20270201014400_create_bill_overlay_tables.sql'),
        ('20291302052000_bill_overlay_rls_policies.sql','20270201014600_bill_overlay_rls_policies.sql'),
        ('20291302053000_bill_overlay_rls_helpers.sql','20270201014800_bill_overlay_rls_helpers.sql'),
        ('20291302054000_bill_void_reversal.sql','20270201015000_bill_void_reversal.sql'),
        ('20291302055000_backfill_payment_intents.sql','20270201015200_backfill_payment_intents.sql'),
        ('20291302056000_reconciliation_locks_db_enforcement.sql','20270201015400_reconciliation_locks_db_enforcement.sql'),
        ('20291302060000_1099_reporting_functions.sql','20270201015600_1099_reporting_functions.sql'),
        ('20291302061000_transactions_metadata_gin_indexes.sql','20270201015800_transactions_metadata_gin_indexes.sql'),
        ('20291302062000_fix_security_definer_views_and_rls_gaps.sql','20270201020000_fix_security_definer_views_and_rls_gaps.sql'),
        ('20291302063000_add_missing_rls_policies.sql','20270201020200_add_missing_rls_policies.sql'),
        ('20291302063000_harden_search_path_and_rls.sql','20270201020400_harden_search_path_and_rls.sql'),
        ('20291302064000_fix_lint_buildium_functions.sql','20270201020600_fix_lint_buildium_functions.sql'),
        ('20291329220000_add_properties_list_index_and_summary_rpc.sql','20270201020800_add_properties_list_index_and_summary_rpc.sql'),
        ('20291329221000_fix_post_transaction_receipt_defaults.sql','20270201021000_fix_post_transaction_receipt_defaults.sql'),
        ('20291329222000_fix_replace_transaction_lines_lease_cast.sql','20270201021200_fix_replace_transaction_lines_lease_cast.sql'),
        ('20251112_update_monthly_log_transaction_bundle.sql','20251112000000_update_monthly_log_transaction_bundle.sql')
    ) as m(old_version, new_version)
    where sm.version = m.old_version
      and not exists (
        select 1 from supabase_migrations.schema_migrations s2
        where s2.version = m.new_version
      )
    returning m.old_version, m.new_version
  loop
    raise notice 'Normalized migration version: % -> %', rec.old_version, rec.new_version;
  end loop;
end $$;
