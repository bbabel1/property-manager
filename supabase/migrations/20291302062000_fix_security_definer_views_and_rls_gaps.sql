-- Address Supabase lint findings:
-- 1) Convert views to SECURITY INVOKER so they honor caller RLS.
-- 2) Enable RLS with explicit policies on telemetry/config tables.

BEGIN;

-- ---------------------------------------------------------------------------
-- View hardening: ensure all views run as invoker
-- ---------------------------------------------------------------------------
ALTER VIEW IF EXISTS public.v_ar_receivables SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_ar_reconciliation SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_undeposited_payments SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_ar_subledger SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_reconciliation_transactions SET (security_invoker = true);
ALTER VIEW IF EXISTS public.payment_events SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_transaction_with_reversal SET (security_invoker = true);
ALTER VIEW IF EXISTS public.payment_lifecycle_projection SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_udf_warnings SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_bank_register_transactions SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_ar_gl_balance SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- RLS: telemetry event tables (allow inserts from clients, reads for debugging)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.lease_telemetry_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lease_telemetry_events_select_all ON public.lease_telemetry_events;
CREATE POLICY lease_telemetry_events_select_all ON public.lease_telemetry_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS lease_telemetry_events_insert_all ON public.lease_telemetry_events;
CREATE POLICY lease_telemetry_events_insert_all ON public.lease_telemetry_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS lease_telemetry_events_service_role_all ON public.lease_telemetry_events;
CREATE POLICY lease_telemetry_events_service_role_all ON public.lease_telemetry_events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE IF EXISTS public.charge_telemetry_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS charge_telemetry_events_select_all ON public.charge_telemetry_events;
CREATE POLICY charge_telemetry_events_select_all ON public.charge_telemetry_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS charge_telemetry_events_insert_all ON public.charge_telemetry_events;
CREATE POLICY charge_telemetry_events_insert_all ON public.charge_telemetry_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS charge_telemetry_events_service_role_all ON public.charge_telemetry_events;
CREATE POLICY charge_telemetry_events_service_role_all ON public.charge_telemetry_events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- RLS: org-scoped accounting config (admins + service role)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.org_accounting_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_accounting_config_select_org ON public.org_accounting_config;
CREATE POLICY org_accounting_config_select_org ON public.org_accounting_config
  FOR SELECT USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS org_accounting_config_write_org_admin ON public.org_accounting_config;
CREATE POLICY org_accounting_config_write_org_admin ON public.org_accounting_config
  FOR INSERT WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS org_accounting_config_update_org_admin ON public.org_accounting_config;
CREATE POLICY org_accounting_config_update_org_admin ON public.org_accounting_config
  FOR UPDATE USING (public.is_org_admin_or_manager(auth.uid(), org_id))
  WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS org_accounting_config_delete_org_admin ON public.org_accounting_config;
CREATE POLICY org_accounting_config_delete_org_admin ON public.org_accounting_config
  FOR DELETE USING (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS org_accounting_config_service_role_all ON public.org_accounting_config;
CREATE POLICY org_accounting_config_service_role_all ON public.org_accounting_config
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- RLS: migration marker (service role only)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.deposit_migration_marker ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deposit_migration_marker_service_role_all ON public.deposit_migration_marker;
CREATE POLICY deposit_migration_marker_service_role_all ON public.deposit_migration_marker
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- RLS: Buildium failure codes lookup (read open, writes via service role)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.buildium_failure_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS buildium_failure_codes_select_all ON public.buildium_failure_codes;
CREATE POLICY buildium_failure_codes_select_all ON public.buildium_failure_codes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS buildium_failure_codes_service_role_all ON public.buildium_failure_codes;
CREATE POLICY buildium_failure_codes_service_role_all ON public.buildium_failure_codes
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
