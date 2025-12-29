-- Cleanup unused schema: tables and views with 0 runtime references
-- Based on audit report: docs/CLEANUP_AUDIT_REPORT.md
-- Generated: 2025-01-31
--
-- This migration removes tables and views that have been confirmed to have
-- zero runtime references in the codebase (src/, scripts/, supabase/ excluding migrations/types).
--
-- To opt-out of any removal, comment out the corresponding DROP statement.

BEGIN;

-- ============================================================================
-- TABLES WITH 0 RUNTIME REFERENCES
-- ============================================================================

-- Cache tables (only mentioned in schema tooling)
DROP TABLE IF EXISTS public.buildium_api_cache CASCADE;
-- Migration: 20240101000001_001_initial_schema.sql
-- Reason: 0 runtime references; only in scripts/database/get-table-schema.ts

DROP TABLE IF EXISTS public.owners_list_cache CASCADE;
-- Migration: Created in initial schema
-- Reason: 0 runtime references; only in schema tooling scripts
-- Note: Data can be regenerated from owners + ownerships tables

-- Appliance service history (never read/written in code)
DROP TABLE IF EXISTS public.appliance_service_history CASCADE;
-- Migration: 20250829150000_041_add_appliance_buildium_and_service_history.sql
-- Reason: 0 runtime references; drop unless future appliance feature planned
-- Note: Data may be replaced by task_history or work_orders

-- NYC Open Data integration (no app usage)
DROP TABLE IF EXISTS public.nyc_open_data_integrations CASCADE;
-- Migration: 20260324100000_create_nyc_open_data_integrations.sql
-- Reason: 0 runtime references; remove or defer until NYC Open Data work resumes

-- Building permit join table (never wired up)
DROP TABLE IF EXISTS public.building_permit_units CASCADE;
-- Migration: 20260331120000_create_building_permits.sql
-- Reason: 0 runtime references; building-permit sync writes only to building_permits
-- Note: Join table never wired up. Drop or wire it up before keeping.

-- Service automation tables (zero touches in code)
DROP TABLE IF EXISTS public.property_automation_overrides CASCADE;
-- Migration: Service automation tranche (20250120120004/05)
-- Reason: 0 runtime references; delete or feature-flag plan before keeping

DROP TABLE IF EXISTS public.service_fee_history CASCADE;
-- Migration: Service automation tranche (20250120120004/05)
-- Reason: 0 runtime references; delete or feature-flag plan before keeping

-- Property onboarding tables (no API/UI writers)
DROP TABLE IF EXISTS public.property_onboarding_tasks CASCADE;
-- Migration: 20250912120000_067_dashboard_kpis.sql
-- Reason: 0 runtime references; no API/UI writers

DROP TABLE IF EXISTS public.property_onboarding CASCADE;
-- Migration: 20250912120000_067_dashboard_kpis.sql
-- Reason: 0 runtime references; no API/UI writers

-- ============================================================================
-- VIEWS WITH 0 RUNTIME REFERENCES
-- ============================================================================

-- Diagnostic views (not actively used for monitoring)
DROP VIEW IF EXISTS public.foreign_key_relationships CASCADE;
DROP VIEW IF EXISTS public.index_usage CASCADE;
DROP VIEW IF EXISTS public.primary_keys CASCADE;
DROP VIEW IF EXISTS public.table_sizes CASCADE;
DROP VIEW IF EXISTS public.slow_queries CASCADE;
DROP VIEW IF EXISTS public.invalid_country_values CASCADE;

-- Financial/Reporting views (superseded or unused)
DROP VIEW IF EXISTS public.transaction_amounts CASCADE;
DROP VIEW IF EXISTS public.unbalanced_transactions CASCADE;
DROP VIEW IF EXISTS public.v_gl_trial_balance CASCADE;
DROP VIEW IF EXISTS public.v_latest_reconciliation_by_account CASCADE;
DROP VIEW IF EXISTS public.v_legacy_management_fees CASCADE;
DROP VIEW IF EXISTS public.v_work_order_summary CASCADE;

-- Buildium/Webhook views
DROP VIEW IF EXISTS public.buildium_webhook_events_unhandled CASCADE;

-- Property onboarding view (related to dropped tables above)
DROP VIEW IF EXISTS public.v_property_onboarding_summary CASCADE;
-- Migration: 20250912120000_067_dashboard_kpis.sql
-- Reason: Related to property_onboarding tables (dropped above)

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- Tables/views NOT included in this migration (require validation):
-- - inspections (medium risk, requires validation)
-- - buildium_api_log (consider retention policy vs removal)
-- - property_ownerships_cache (has active fallback logic, keep for now)
--
-- If any of the above removals cause issues, they can be restored from:
-- 1. Git history (migration files)
-- 2. Database backup (if taken before this migration)
-- 3. Supabase migration rollback (if supported in your environment)

COMMIT;
