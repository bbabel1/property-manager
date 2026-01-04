-- Migration: Fix Security Definer Views and Enable RLS
-- Purpose: Convert security definer views to security invoker and enable RLS
--          on all tables that need it with appropriate policies
-- ============================================================================
-- PART 1: CONVERT SECURITY DEFINER VIEWS TO SECURITY INVOKER
-- ============================================================================

-- Convert views to security invoker by recreating them
-- PostgreSQL 15+ supports ALTER VIEW ... SET (security_invoker = true)
-- For older versions, we recreate the views with the security_invoker option

-- Helper function to convert view to security invoker
CREATE OR REPLACE FUNCTION public.convert_view_to_invoker(view_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_def text;
  v_schema text := 'public';
  v_full_name text;
BEGIN
  v_full_name := format('%I.%I', v_schema, view_name);
  
  -- Get the view definition (pretty-printed, no schema qualifiers)
  SELECT pg_get_viewdef(v_full_name::regclass, true) INTO v_def;
  
  -- Recreate with security_invoker option
  -- Use CREATE OR REPLACE to avoid dropping dependencies
  EXECUTE format('CREATE OR REPLACE VIEW %s WITH (security_invoker=true) AS %s', v_full_name, v_def);
END;
$$;

-- Convert all views to security invoker
SELECT public.convert_view_to_invoker('v_reconciliation_variance_alerts');
SELECT public.convert_view_to_invoker('v_rent_roll_current_month');
SELECT public.convert_view_to_invoker('v_dashboard_kpis');
SELECT public.convert_view_to_invoker('v_recent_transactions_ranked');
SELECT public.convert_view_to_invoker('user_profiles');
SELECT public.convert_view_to_invoker('v_rent_roll_previous_month');
SELECT public.convert_view_to_invoker('v_bank_register_transactions');
SELECT public.convert_view_to_invoker('v_reconciliation_variances');
SELECT public.convert_view_to_invoker('v_active_work_orders_ranked');
SELECT public.convert_view_to_invoker('v_lease_renewals_summary');

-- Clean up helper function
DROP FUNCTION IF EXISTS public.convert_view_to_invoker(text);

-- Re-grant select permissions on views
GRANT SELECT ON public.v_reconciliation_variance_alerts TO authenticated;
GRANT SELECT ON public.v_rent_roll_current_month TO authenticated;
GRANT SELECT ON public.v_dashboard_kpis TO authenticated;
GRANT SELECT ON public.v_recent_transactions_ranked TO authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.v_rent_roll_previous_month TO authenticated;
GRANT SELECT ON public.v_bank_register_transactions TO authenticated;
GRANT SELECT ON public.v_reconciliation_variances TO authenticated;
GRANT SELECT ON public.v_active_work_orders_ranked TO authenticated;
GRANT SELECT ON public.v_lease_renewals_summary TO authenticated;

-- ============================================================================
-- PART 2: ENABLE RLS ON TABLES AND CREATE POLICIES
-- ============================================================================

-- ============================================================================
-- 2a) TENANT-SCOPED TABLES (via property_id or unit_id -> property_id)
-- ============================================================================

-- unit_images: scoped via unit_id -> property_id -> org_id
ALTER TABLE public.unit_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unit_images_tenant_select" ON public.unit_images;
CREATE POLICY "unit_images_tenant_select" ON public.unit_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE u.id = unit_images.unit_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "unit_images_tenant_insert" ON public.unit_images;
CREATE POLICY "unit_images_tenant_insert" ON public.unit_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE u.id = unit_images.unit_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "unit_images_tenant_update" ON public.unit_images;
CREATE POLICY "unit_images_tenant_update" ON public.unit_images
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE u.id = unit_images.unit_id
        AND m.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE u.id = unit_images.unit_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "unit_images_tenant_delete" ON public.unit_images;
CREATE POLICY "unit_images_tenant_delete" ON public.unit_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE u.id = unit_images.unit_id
        AND m.user_id = auth.uid()
    )
  );

-- unit_notes: scoped via unit_id -> property_id -> org_id
ALTER TABLE public.unit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unit_notes_tenant_select" ON public.unit_notes;
CREATE POLICY "unit_notes_tenant_select" ON public.unit_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE u.id = unit_notes.unit_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "unit_notes_tenant_insert" ON public.unit_notes;
CREATE POLICY "unit_notes_tenant_insert" ON public.unit_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE u.id = unit_notes.unit_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "unit_notes_tenant_update" ON public.unit_notes;
CREATE POLICY "unit_notes_tenant_update" ON public.unit_notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE u.id = unit_notes.unit_id
        AND m.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE u.id = unit_notes.unit_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "unit_notes_tenant_delete" ON public.unit_notes;
CREATE POLICY "unit_notes_tenant_delete" ON public.unit_notes
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE u.id = unit_notes.unit_id
        AND m.user_id = auth.uid()
    )
  );

-- property_notes: scoped via property_id -> org_id
ALTER TABLE public.property_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_notes_tenant_select" ON public.property_notes;
CREATE POLICY "property_notes_tenant_select" ON public.property_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE p.id = property_notes.property_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property_notes_tenant_insert" ON public.property_notes;
CREATE POLICY "property_notes_tenant_insert" ON public.property_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE p.id = property_notes.property_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property_notes_tenant_update" ON public.property_notes;
CREATE POLICY "property_notes_tenant_update" ON public.property_notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE p.id = property_notes.property_id
        AND m.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE p.id = property_notes.property_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property_notes_tenant_delete" ON public.property_notes;
CREATE POLICY "property_notes_tenant_delete" ON public.property_notes
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE p.id = property_notes.property_id
        AND m.user_id = auth.uid()
    )
  );

-- lease_notes: scoped via lease_id -> property_id -> org_id
ALTER TABLE public.lease_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_notes_tenant_select" ON public.lease_notes;
CREATE POLICY "lease_notes_tenant_select" ON public.lease_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_notes.lease_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lease_notes_tenant_insert" ON public.lease_notes;
CREATE POLICY "lease_notes_tenant_insert" ON public.lease_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_notes.lease_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lease_notes_tenant_update" ON public.lease_notes;
CREATE POLICY "lease_notes_tenant_update" ON public.lease_notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_notes.lease_id
        AND m.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_notes.lease_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lease_notes_tenant_delete" ON public.lease_notes;
CREATE POLICY "lease_notes_tenant_delete" ON public.lease_notes
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_notes.lease_id
        AND m.user_id = auth.uid()
    )
  );

-- lease_recurring_transactions: scoped via lease_id -> property_id -> org_id
ALTER TABLE public.lease_recurring_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_recurring_transactions_tenant_select" ON public.lease_recurring_transactions;
CREATE POLICY "lease_recurring_transactions_tenant_select" ON public.lease_recurring_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_recurring_transactions.lease_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lease_recurring_transactions_tenant_insert" ON public.lease_recurring_transactions;
CREATE POLICY "lease_recurring_transactions_tenant_insert" ON public.lease_recurring_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_recurring_transactions.lease_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lease_recurring_transactions_tenant_update" ON public.lease_recurring_transactions;
CREATE POLICY "lease_recurring_transactions_tenant_update" ON public.lease_recurring_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_recurring_transactions.lease_id
        AND m.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_recurring_transactions.lease_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lease_recurring_transactions_tenant_delete" ON public.lease_recurring_transactions;
CREATE POLICY "lease_recurring_transactions_tenant_delete" ON public.lease_recurring_transactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_recurring_transactions.lease_id
        AND m.user_id = auth.uid()
    )
  );

-- journal_entries: scoped via transaction_id -> transactions -> org_id
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_entries_tenant_select" ON public.journal_entries;
CREATE POLICY "journal_entries_tenant_select" ON public.journal_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      JOIN public.org_memberships m ON m.org_id = t.org_id
      WHERE t.id = journal_entries.transaction_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "journal_entries_tenant_insert" ON public.journal_entries;
CREATE POLICY "journal_entries_tenant_insert" ON public.journal_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      JOIN public.org_memberships m ON m.org_id = t.org_id
      WHERE t.id = journal_entries.transaction_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "journal_entries_tenant_update" ON public.journal_entries;
CREATE POLICY "journal_entries_tenant_update" ON public.journal_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      JOIN public.org_memberships m ON m.org_id = t.org_id
      WHERE t.id = journal_entries.transaction_id
        AND m.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      JOIN public.org_memberships m ON m.org_id = t.org_id
      WHERE t.id = journal_entries.transaction_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "journal_entries_tenant_delete" ON public.journal_entries;
CREATE POLICY "journal_entries_tenant_delete" ON public.journal_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      JOIN public.org_memberships m ON m.org_id = t.org_id
      WHERE t.id = journal_entries.transaction_id
        AND m.user_id = auth.uid()
    )
  );

-- statement_emails: scoped via monthly_log_id -> monthly_logs -> property_id -> org_id
ALTER TABLE public.statement_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "statement_emails_tenant_select" ON public.statement_emails;
CREATE POLICY "statement_emails_tenant_select" ON public.statement_emails
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.monthly_logs ml
      JOIN public.properties p ON p.id = ml.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE ml.id = statement_emails.monthly_log_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "statement_emails_tenant_insert" ON public.statement_emails;
CREATE POLICY "statement_emails_tenant_insert" ON public.statement_emails
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.monthly_logs ml
      JOIN public.properties p ON p.id = ml.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE ml.id = statement_emails.monthly_log_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "statement_emails_tenant_update" ON public.statement_emails;
CREATE POLICY "statement_emails_tenant_update" ON public.statement_emails
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.monthly_logs ml
      JOIN public.properties p ON p.id = ml.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE ml.id = statement_emails.monthly_log_id
        AND m.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.monthly_logs ml
      JOIN public.properties p ON p.id = ml.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE ml.id = statement_emails.monthly_log_id
        AND m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 2b) SERVICE-ROLE ONLY TABLES
-- ============================================================================

-- idempotency_keys: service role only (has org_id but should be locked down)
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "idempotency_keys_service_only" ON public.idempotency_keys;
CREATE POLICY "idempotency_keys_service_only" ON public.idempotency_keys
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- webhook_event_flags: service role only
ALTER TABLE public.webhook_event_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_event_flags_service_only" ON public.webhook_event_flags;
CREATE POLICY "webhook_event_flags_service_only" ON public.webhook_event_flags
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- gl_import_cursors: service role only
ALTER TABLE public.gl_import_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gl_import_cursors_service_only" ON public.gl_import_cursors;
CREATE POLICY "gl_import_cursors_service_only" ON public.gl_import_cursors
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 2c) REFERENCE/LOOKUP TABLES (read-only for authenticated users)
-- ============================================================================

-- transaction_type_sign: read-only reference data
ALTER TABLE public.transaction_type_sign ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transaction_type_sign_read_any" ON public.transaction_type_sign;
CREATE POLICY "transaction_type_sign_read_any" ON public.transaction_type_sign
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- gl_account_category: read-only reference data
ALTER TABLE public.gl_account_category ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gl_account_category_read_any" ON public.gl_account_category;
CREATE POLICY "gl_account_category_read_any" ON public.gl_account_category
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- device_type_normalization: read-only reference data
ALTER TABLE public.device_type_normalization ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_type_normalization_read_any" ON public.device_type_normalization;
CREATE POLICY "device_type_normalization_read_any" ON public.device_type_normalization
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- data_sources: read-only global catalog
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_sources_read_any" ON public.data_sources;
CREATE POLICY "data_sources_read_any" ON public.data_sources
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 2d) PERMISSIONS TABLE (org-scoped with service role access)
-- ============================================================================

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
DROP POLICY IF EXISTS "permissions_service_all" ON public.permissions;
CREATE POLICY "permissions_service_all" ON public.permissions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can read permissions for their orgs (or system permissions)
DROP POLICY IF EXISTS "permissions_org_read" ON public.permissions;
CREATE POLICY "permissions_org_read" ON public.permissions
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR permissions.org_id IS NULL  -- System permissions
    OR EXISTS (
      SELECT 1
      FROM public.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = permissions.org_id
    )
  );

-- ============================================================================
-- PART 3: FORCE ROW LEVEL SECURITY (prevent owner bypass)
-- ============================================================================

ALTER TABLE public.unit_images FORCE ROW LEVEL SECURITY;
ALTER TABLE public.unit_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.property_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lease_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lease_recurring_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.statement_emails FORCE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_event_flags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gl_import_cursors FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_type_sign FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gl_account_category FORCE ROW LEVEL SECURITY;
ALTER TABLE public.device_type_normalization FORCE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;

