-- Address Supabase lint warnings:
-- - Pin search_path on public functions so search_path cannot be hijacked.
-- - Tighten RLS on telemetry/property_images tables.

BEGIN;

-- Pin search_path on flagged functions (only when not already set).
DO $$
DECLARE
  target_names text[] := ARRAY[
    'backfill_deposit_items_from_transaction_payment_transactions',
    'backfill_deposit_meta_from_transactions',
    'bill_applications_org_guard',
    'bill_workflow_org_guard',
    'calculate_book_balance',
    'calculate_vendor_1099_total',
    'generate_deposit_id',
    'get_property_financials',
    'gl_account_activity',
    'gl_account_activity_cash_basis',
    'gl_ledger_balance_as_of',
    'gl_trial_balance_as_of',
    'has_reconciled_bank_lines',
    'identify_permissive_policies_to_consolidate',
    'journal_entries_property_org_guard',
    'journal_entries_unit_org_guard',
    'list_1099_candidates',
    'prevent_locked_transaction_modification',
    'refresh_unit_status_from_leases',
    'set_charges_amount_open_default',
    'transactions_property_org_guard',
    'transactions_unit_org_guard',
    'trigger_refresh_unit_status_from_lease',
    'trg_bill_applications_validate',
    'trg_prevent_reconciled_application_edit',
    'trg_recompute_bill_status',
    'trg_update_transaction_reconciled_flag',
    'validate_gl_account_scope',
    'validate_transaction_scope'
  ];
  r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS ident
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname = ANY(target_names)
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) AS c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.ident);
  END LOOP;
END $$;

-- Telemetry: restrict to org members or service role instead of open TRUE policies.
ALTER TABLE IF EXISTS public.lease_telemetry_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lease_telemetry_events_select_all ON public.lease_telemetry_events;
DROP POLICY IF EXISTS lease_telemetry_events_insert_all ON public.lease_telemetry_events;
DROP POLICY IF EXISTS lease_telemetry_events_service_role_all ON public.lease_telemetry_events;
DROP POLICY IF EXISTS lease_telemetry_events_member_select ON public.lease_telemetry_events;
DROP POLICY IF EXISTS lease_telemetry_events_member_insert ON public.lease_telemetry_events;

CREATE POLICY lease_telemetry_events_service_role_all ON public.lease_telemetry_events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY lease_telemetry_events_member_select ON public.lease_telemetry_events
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND (
        org_id IS NULL
        OR (
          org_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND public.is_org_member(auth.uid(), org_id::uuid)
        )
      )
    )
  );

CREATE POLICY lease_telemetry_events_member_insert ON public.lease_telemetry_events
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND (
        org_id IS NULL
        OR (
          org_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND public.is_org_member(auth.uid(), org_id::uuid)
        )
      )
    )
  );

ALTER TABLE IF EXISTS public.charge_telemetry_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS charge_telemetry_events_select_all ON public.charge_telemetry_events;
DROP POLICY IF EXISTS charge_telemetry_events_insert_all ON public.charge_telemetry_events;
DROP POLICY IF EXISTS charge_telemetry_events_service_role_all ON public.charge_telemetry_events;
DROP POLICY IF EXISTS charge_telemetry_events_member_select ON public.charge_telemetry_events;
DROP POLICY IF EXISTS charge_telemetry_events_member_insert ON public.charge_telemetry_events;

CREATE POLICY charge_telemetry_events_service_role_all ON public.charge_telemetry_events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY charge_telemetry_events_member_select ON public.charge_telemetry_events
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND (
        org_id IS NULL
        OR (
          org_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND public.is_org_member(auth.uid(), org_id::uuid)
        )
      )
    )
  );

CREATE POLICY charge_telemetry_events_member_insert ON public.charge_telemetry_events
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND (
        org_id IS NULL
        OR (
          org_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND public.is_org_member(auth.uid(), org_id::uuid)
        )
      )
    )
  );

-- Property images: scope to org members on the related property or service role.
ALTER TABLE IF EXISTS public.property_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "property_images_allow_all" ON public.property_images;
DROP POLICY IF EXISTS property_images_allow_all ON public.property_images;
DROP POLICY IF EXISTS property_images_all_guard ON public.property_images;

CREATE POLICY property_images_all_guard ON public.property_images
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND public.is_org_member(auth.uid(), p.org_id)
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND public.is_org_member(auth.uid(), p.org_id)
    )
  );

COMMIT;
