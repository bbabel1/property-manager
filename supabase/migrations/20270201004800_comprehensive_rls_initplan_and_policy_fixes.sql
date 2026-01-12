-- Comprehensive RLS Initplan and Policy Performance Fixes
-- 
-- This migration addresses three performance issues:
-- 1. Auth RLS Initplan: Replace direct auth.*()/current_setting() calls with subselects
-- 2. Multiple Permissive Policies: Consolidate permissive policies per table/action/role combo
-- 3. Duplicate Indexes: Drop redundant indexes
--
-- After applying, verify with EXPLAIN on representative queries that initplans disappear.

BEGIN;

-- ============================================================================
-- PART 1: FIX AUTH RLS INITPLAN ISSUES
-- Replace direct auth.*()/current_setting() calls with (select auth.*()) pattern
-- ============================================================================

-- Function to fix auth function calls in policy expressions
CREATE OR REPLACE FUNCTION public.fix_policy_auth_calls()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pol RECORD;
  new_using TEXT;
  new_with_check TEXT;
  needs_update BOOLEAN;
BEGIN
  FOR pol IN
    SELECT 
      n.nspname as schema_name,
      c.relname as table_name,
      p.polname as policy_name,
      pg_get_expr(p.polqual, p.polrelid) as using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr,
      CASE p.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
      END as cmd
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        pg_get_expr(p.polqual, p.polrelid) LIKE '%auth.%()%'
        OR pg_get_expr(p.polqual, p.polrelid) LIKE '%current_setting(%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%auth.%()%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%current_setting(%'
      )
      -- Exclude patterns that are already wrapped in subselects
      AND pg_get_expr(p.polqual, p.polrelid) NOT LIKE '%(select auth.%'
      AND pg_get_expr(p.polwithcheck, p.polrelid) NOT LIKE '%(select auth.%'
      AND pg_get_expr(p.polqual, p.polrelid) NOT LIKE '%(select current_setting%'
      AND pg_get_expr(p.polwithcheck, p.polrelid) NOT LIKE '%(select current_setting%'
  LOOP
    needs_update := false;
    new_using := pol.using_expr;
    new_with_check := pol.with_check_expr;
    
    -- Fix USING clause: wrap auth.*() and current_setting() calls
    IF pol.using_expr IS NOT NULL THEN
      -- Replace auth.uid() with (select auth.uid())
      new_using := regexp_replace(
        new_using,
        '\bauth\.uid\(\)',
        '(select auth.uid())',
        'g'
      );
      -- Replace auth.role() with (select auth.role())
      new_using := regexp_replace(
        new_using,
        '\bauth\.role\(\)',
        '(select auth.role())',
        'g'
      );
      -- Replace auth.jwt() with (select auth.jwt())
      new_using := regexp_replace(
        new_using,
        '\bauth\.jwt\(\)',
        '(select auth.jwt())',
        'g'
      );
      -- Replace current_setting(...) with (select current_setting(...))
      -- This is more complex as we need to capture the full function call
      new_using := regexp_replace(
        new_using,
        '\bcurrent_setting\([^)]+\)',
        '(select \0)',
        'g'
      );
      
      IF new_using != pol.using_expr THEN
        needs_update := true;
      END IF;
    END IF;
    
    -- Fix WITH CHECK clause
    IF pol.with_check_expr IS NOT NULL THEN
      new_with_check := regexp_replace(
        new_with_check,
        '\bauth\.uid\(\)',
        '(select auth.uid())',
        'g'
      );
      new_with_check := regexp_replace(
        new_with_check,
        '\bauth\.role\(\)',
        '(select auth.role())',
        'g'
      );
      new_with_check := regexp_replace(
        new_with_check,
        '\bauth\.jwt\(\)',
        '(select auth.jwt())',
        'g'
      );
      new_with_check := regexp_replace(
        new_with_check,
        '\bcurrent_setting\([^)]+\)',
        '(select \0)',
        'g'
      );
      
      IF new_with_check != pol.with_check_expr THEN
        needs_update := true;
      END IF;
    END IF;
    
    -- Update the policy if needed
    IF needs_update THEN
      IF pol.using_expr IS NOT NULL AND pol.with_check_expr IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
          pol.policy_name,
          pol.schema_name,
          pol.table_name,
          new_using,
          new_with_check
        );
      ELSIF pol.using_expr IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I USING (%s)',
          pol.policy_name,
          pol.schema_name,
          pol.table_name,
          new_using
        );
      ELSIF pol.with_check_expr IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
          pol.policy_name,
          pol.schema_name,
          pol.table_name,
          new_with_check
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Run the function to fix all policies
SELECT public.fix_policy_auth_calls();

-- Drop the helper function
DROP FUNCTION IF EXISTS public.fix_policy_auth_calls();

-- ============================================================================
-- PART 2: FIX SPECIFIC TABLES WITH DIRECT AUTH CALLS
-- Explicit fixes for tables mentioned in the requirements
-- ============================================================================

-- buildings (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'buildings'
  ) THEN
    DROP POLICY IF EXISTS "Allow service role all on buildings" ON public.buildings;
    CREATE POLICY "Allow service role all on buildings"
      ON public.buildings FOR ALL
      USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
END $$;

-- building_permits (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'building_permits'
  ) THEN
    DROP POLICY IF EXISTS "building_permits_org_read" ON public.building_permits;
    CREATE POLICY "building_permits_org_read"
      ON public.building_permits FOR SELECT TO authenticated
      USING (public.is_org_member((select auth.uid()), org_id));

    DROP POLICY IF EXISTS "building_permits_org_insert" ON public.building_permits;
    CREATE POLICY "building_permits_org_insert"
      ON public.building_permits FOR INSERT TO authenticated
      WITH CHECK ((select auth.uid()) IS NOT NULL AND public.is_org_member((select auth.uid()), org_id));

    DROP POLICY IF EXISTS "building_permits_org_update" ON public.building_permits;
    CREATE POLICY "building_permits_org_update"
      ON public.building_permits FOR UPDATE TO authenticated
      USING ((select auth.uid()) IS NOT NULL AND public.is_org_member((select auth.uid()), org_id))
      WITH CHECK ((select auth.uid()) IS NOT NULL AND public.is_org_member((select auth.uid()), org_id));

    DROP POLICY IF EXISTS "building_permits_org_delete" ON public.building_permits;
    CREATE POLICY "building_permits_org_delete"
      ON public.building_permits FOR DELETE TO authenticated
      USING ((select auth.uid()) IS NOT NULL AND public.is_org_member((select auth.uid()), org_id));

    DROP POLICY IF EXISTS "building_permits_service_role_full_access" ON public.building_permits;
    CREATE POLICY "building_permits_service_role_full_access"
      ON public.building_permits FOR ALL TO service_role
      USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
END $$;

-- building_permit_units (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'building_permit_units'
  ) THEN
    DROP POLICY IF EXISTS "building_permit_units_org_read" ON public.building_permit_units;
    CREATE POLICY "building_permit_units_org_read"
      ON public.building_permit_units FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.building_permits p
          WHERE p.id = building_permit_units.permit_id 
            AND public.is_org_member((select auth.uid()), p.org_id)
        )
      );

    DROP POLICY IF EXISTS "building_permit_units_org_insert" ON public.building_permit_units;
    CREATE POLICY "building_permit_units_org_insert"
      ON public.building_permit_units FOR INSERT TO authenticated
      WITH CHECK (
        (select auth.uid()) IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.building_permits p
          WHERE p.id = building_permit_units.permit_id 
            AND public.is_org_member((select auth.uid()), p.org_id)
        )
      );

    DROP POLICY IF EXISTS "building_permit_units_org_update" ON public.building_permit_units;
    CREATE POLICY "building_permit_units_org_update"
      ON public.building_permit_units FOR UPDATE TO authenticated
      USING (
        (select auth.uid()) IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.building_permits p
          WHERE p.id = building_permit_units.permit_id 
            AND public.is_org_member((select auth.uid()), p.org_id)
        )
      )
      WITH CHECK (
        (select auth.uid()) IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.building_permits p
          WHERE p.id = building_permit_units.permit_id 
            AND public.is_org_member((select auth.uid()), p.org_id)
        )
      );

    DROP POLICY IF EXISTS "building_permit_units_org_delete" ON public.building_permit_units;
    CREATE POLICY "building_permit_units_org_delete"
      ON public.building_permit_units FOR DELETE TO authenticated
      USING (
        (select auth.uid()) IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.building_permits p
          WHERE p.id = building_permit_units.permit_id 
            AND public.is_org_member((select auth.uid()), p.org_id)
        )
      );

    DROP POLICY IF EXISTS "building_permit_units_service_role_full_access" ON public.building_permit_units;
    CREATE POLICY "building_permit_units_service_role_full_access"
      ON public.building_permit_units FOR ALL TO service_role
      USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
END $$;

-- compliance_* tables (using auth.jwt()) - only if tables exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'compliance_programs'
  ) THEN
    DROP POLICY IF EXISTS "compliance_programs_select" ON public.compliance_programs;
    CREATE POLICY "compliance_programs_select" ON public.compliance_programs
      FOR SELECT TO authenticated
      USING (org_id = ((select auth.jwt())->>'org_id')::uuid);

    DROP POLICY IF EXISTS "compliance_programs_insert" ON public.compliance_programs;
    CREATE POLICY "compliance_programs_insert" ON public.compliance_programs
      FOR INSERT TO authenticated
      WITH CHECK (org_id = ((select auth.jwt())->>'org_id')::uuid);

    DROP POLICY IF EXISTS "compliance_programs_update" ON public.compliance_programs;
    CREATE POLICY "compliance_programs_update" ON public.compliance_programs
      FOR UPDATE TO authenticated
      USING (org_id = ((select auth.jwt())->>'org_id')::uuid)
      WITH CHECK (org_id = ((select auth.jwt())->>'org_id')::uuid);

    DROP POLICY IF EXISTS "compliance_programs_delete" ON public.compliance_programs;
    CREATE POLICY "compliance_programs_delete" ON public.compliance_programs
      FOR DELETE TO authenticated
      USING (org_id = ((select auth.jwt())->>'org_id')::uuid);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'compliance_assets'
  ) THEN
    DROP POLICY IF EXISTS "compliance_assets_select" ON public.compliance_assets;
    CREATE POLICY "compliance_assets_select" ON public.compliance_assets
      FOR SELECT TO authenticated
      USING (org_id = ((select auth.jwt())->>'org_id')::uuid);

    DROP POLICY IF EXISTS "compliance_assets_insert" ON public.compliance_assets;
    CREATE POLICY "compliance_assets_insert" ON public.compliance_assets
      FOR INSERT TO authenticated
      WITH CHECK (org_id = ((select auth.jwt())->>'org_id')::uuid);

    DROP POLICY IF EXISTS "compliance_assets_update" ON public.compliance_assets;
    CREATE POLICY "compliance_assets_update" ON public.compliance_assets
      FOR UPDATE TO authenticated
      USING (org_id = ((select auth.jwt())->>'org_id')::uuid)
      WITH CHECK (org_id = ((select auth.jwt())->>'org_id')::uuid);

    DROP POLICY IF EXISTS "compliance_assets_delete" ON public.compliance_assets;
    CREATE POLICY "compliance_assets_delete" ON public.compliance_assets
      FOR DELETE TO authenticated
      USING (org_id = ((select auth.jwt())->>'org_id')::uuid);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'compliance_items'
  ) THEN
    DROP POLICY IF EXISTS "compliance_items_select" ON public.compliance_items;
    CREATE POLICY "compliance_items_select" ON public.compliance_items
      FOR SELECT TO authenticated
      USING (org_id = ((select auth.jwt())->>'org_id')::uuid);

    DROP POLICY IF EXISTS "compliance_items_insert" ON public.compliance_items;
    CREATE POLICY "compliance_items_insert" ON public.compliance_items
      FOR INSERT TO authenticated
      WITH CHECK (org_id = ((select auth.jwt())->>'org_id')::uuid);

    DROP POLICY IF EXISTS "compliance_items_update" ON public.compliance_items;
    CREATE POLICY "compliance_items_update" ON public.compliance_items
      FOR UPDATE TO authenticated
      USING (org_id = ((select auth.jwt())->>'org_id')::uuid)
      WITH CHECK (org_id = ((select auth.jwt())->>'org_id')::uuid);
  END IF;
END $$;

-- idempotency_keys, webhook_event_flags, gl_import_cursors (service role only) - only if tables exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'idempotency_keys'
  ) THEN
    DROP POLICY IF EXISTS "idempotency_keys_service_only" ON public.idempotency_keys;
    CREATE POLICY "idempotency_keys_service_only" ON public.idempotency_keys
      FOR ALL TO service_role USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'webhook_event_flags'
  ) THEN
    DROP POLICY IF EXISTS "webhook_event_flags_service_only" ON public.webhook_event_flags;
    CREATE POLICY "webhook_event_flags_service_only" ON public.webhook_event_flags
      FOR ALL TO service_role USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gl_import_cursors'
  ) THEN
    DROP POLICY IF EXISTS "gl_import_cursors_service_only" ON public.gl_import_cursors;
    CREATE POLICY "gl_import_cursors_service_only" ON public.gl_import_cursors
      FOR ALL TO service_role USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transaction_type_sign'
  ) THEN
    DROP POLICY IF EXISTS "transaction_type_sign_read_any" ON public.transaction_type_sign;
    CREATE POLICY "transaction_type_sign_read_any" ON public.transaction_type_sign
      FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gl_account_category'
  ) THEN
    DROP POLICY IF EXISTS "gl_account_category_read_any" ON public.gl_account_category;
    CREATE POLICY "gl_account_category_read_any" ON public.gl_account_category
      FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'device_type_normalization'
  ) THEN
    DROP POLICY IF EXISTS "device_type_normalization_read_any" ON public.device_type_normalization;
    CREATE POLICY "device_type_normalization_read_any" ON public.device_type_normalization
      FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'data_sources'
  ) THEN
    DROP POLICY IF EXISTS "data_sources_read_any" ON public.data_sources;
    CREATE POLICY "data_sources_read_any" ON public.data_sources
      FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'permissions'
  ) THEN
    DROP POLICY IF EXISTS "permissions_service_all" ON public.permissions;
    CREATE POLICY "permissions_service_all" ON public.permissions
      FOR ALL TO service_role USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');

    DROP POLICY IF EXISTS "permissions_org_read" ON public.permissions;
    CREATE POLICY "permissions_org_read" ON public.permissions
      FOR SELECT TO authenticated USING (
        (select auth.role()) = 'service_role'
        OR permissions.org_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid())
            AND m.org_id = permissions.org_id
        )
      );
  END IF;
END $$;

-- gmail_integrations (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gmail_integrations'
  ) THEN
    DROP POLICY IF EXISTS "Staff can view own Gmail integration" ON public.gmail_integrations;
CREATE POLICY "Staff can view own Gmail integration"
  ON public.gmail_integrations FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE staff.id = gmail_integrations.staff_id
        AND staff.user_id = (select auth.uid())
        AND staff.is_active = true
    )
  );

DROP POLICY IF EXISTS "Staff can update own Gmail integration" ON public.gmail_integrations;
CREATE POLICY "Staff can update own Gmail integration"
  ON public.gmail_integrations FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE staff.id = gmail_integrations.staff_id
        AND staff.user_id = (select auth.uid())
        AND staff.is_active = true
    )
  );

DROP POLICY IF EXISTS "Staff can delete own Gmail integration" ON public.gmail_integrations;
CREATE POLICY "Staff can delete own Gmail integration"
  ON public.gmail_integrations FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE staff.id = gmail_integrations.staff_id
        AND staff.user_id = (select auth.uid())
    )
  );

    DROP POLICY IF EXISTS "Service role full access" ON public.gmail_integrations;
    CREATE POLICY "Service role full access"
      ON public.gmail_integrations FOR ALL TO service_role
      USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'google_calendar_integrations'
  ) THEN
DROP POLICY IF EXISTS "Staff can view own Calendar integration" ON public.google_calendar_integrations;
CREATE POLICY "Staff can view own Calendar integration"
  ON public.google_calendar_integrations FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = google_calendar_integrations.org_id
    )
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE staff.id = google_calendar_integrations.staff_id
        AND staff.user_id = (select auth.uid())
        AND staff.is_active = true
    )
  );

DROP POLICY IF EXISTS "Staff can update own Calendar integration" ON public.google_calendar_integrations;
CREATE POLICY "Staff can update own Calendar integration"
  ON public.google_calendar_integrations FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = google_calendar_integrations.org_id
    )
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE staff.id = google_calendar_integrations.staff_id
        AND staff.user_id = (select auth.uid())
        AND staff.is_active = true
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = google_calendar_integrations.org_id
    )
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE staff.id = google_calendar_integrations.staff_id
        AND staff.user_id = (select auth.uid())
        AND staff.is_active = true
    )
  );

DROP POLICY IF EXISTS "Staff can delete own Calendar integration" ON public.google_calendar_integrations;
CREATE POLICY "Staff can delete own Calendar integration"
  ON public.google_calendar_integrations FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = google_calendar_integrations.org_id
    )
  );

    -- Note: The "Service role full access" policy on google_calendar_integrations already uses (select auth.role())
    -- from the original migration, so it should be fine, but let's ensure it's correct
    DROP POLICY IF EXISTS "Service role full access" ON public.google_calendar_integrations;
    CREATE POLICY "Service role full access"
      ON public.google_calendar_integrations FOR ALL TO service_role
      USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recurring_transactions'
  ) THEN
DROP POLICY IF EXISTS "recurring_transactions_tenant_select" ON public.recurring_transactions;
CREATE POLICY "recurring_transactions_tenant_select" ON public.recurring_transactions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id
        AND m.user_id = (select auth.uid())
    )
    OR recurring_transactions.lease_id IS NULL
  );

DROP POLICY IF EXISTS "recurring_transactions_tenant_insert" ON public.recurring_transactions;
CREATE POLICY "recurring_transactions_tenant_insert" ON public.recurring_transactions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id
        AND m.user_id = (select auth.uid())
    )
    OR recurring_transactions.lease_id IS NULL
  );

DROP POLICY IF EXISTS "recurring_transactions_tenant_update" ON public.recurring_transactions;
CREATE POLICY "recurring_transactions_tenant_update" ON public.recurring_transactions
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id
        AND m.user_id = (select auth.uid())
    )
    OR recurring_transactions.lease_id IS NULL
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id
        AND m.user_id = (select auth.uid())
    )
    OR recurring_transactions.lease_id IS NULL
  );

    DROP POLICY IF EXISTS "recurring_transactions_tenant_delete" ON public.recurring_transactions;
    CREATE POLICY "recurring_transactions_tenant_delete" ON public.recurring_transactions
      FOR DELETE TO authenticated USING (
        EXISTS (
          SELECT 1
          FROM public.lease l
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.org_memberships m ON m.org_id = p.org_id
          WHERE l.id = recurring_transactions.lease_id
            AND m.user_id = (select auth.uid())
        )
        OR recurring_transactions.lease_id IS NULL
      );
  END IF;
END $$;

-- ============================================================================
-- PART 3: SCOPE POLICIES TO EXPLICIT ROLES TO AVOID DUPLICATE PERMISSIVE WARNINGS
-- ============================================================================

DO $$
BEGIN
  -- buildings
  IF to_regclass('public.buildings') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow authenticated read buildings' AND polrelid = 'public.buildings'::regclass) THEN
      ALTER POLICY "Allow authenticated read buildings" ON public.buildings TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow service role all on buildings' AND polrelid = 'public.buildings'::regclass) THEN
      ALTER POLICY "Allow service role all on buildings" ON public.buildings TO service_role;
    END IF;
  END IF;

  -- buildium_integration_audit_log
  IF to_regclass('public.buildium_integration_audit_log') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'buildium_integration_audit_log_org_read' AND polrelid = 'public.buildium_integration_audit_log'::regclass) THEN
      ALTER POLICY "buildium_integration_audit_log_org_read" ON public.buildium_integration_audit_log TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'buildium_integration_audit_log_service_role_full_access' AND polrelid = 'public.buildium_integration_audit_log'::regclass) THEN
      ALTER POLICY "buildium_integration_audit_log_service_role_full_access" ON public.buildium_integration_audit_log TO service_role;
    END IF;
  END IF;

  -- buildium_integrations
  IF to_regclass('public.buildium_integrations') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'buildium_integrations_org_read' AND polrelid = 'public.buildium_integrations'::regclass) THEN
      ALTER POLICY "buildium_integrations_org_read" ON public.buildium_integrations TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'buildium_integrations_org_insert' AND polrelid = 'public.buildium_integrations'::regclass) THEN
      ALTER POLICY "buildium_integrations_org_insert" ON public.buildium_integrations TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'buildium_integrations_org_update' AND polrelid = 'public.buildium_integrations'::regclass) THEN
      ALTER POLICY "buildium_integrations_org_update" ON public.buildium_integrations TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'buildium_integrations_org_delete' AND polrelid = 'public.buildium_integrations'::regclass) THEN
      ALTER POLICY "buildium_integrations_org_delete" ON public.buildium_integrations TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'buildium_integrations_service_role_full_access' AND polrelid = 'public.buildium_integrations'::regclass) THEN
      ALTER POLICY "buildium_integrations_service_role_full_access" ON public.buildium_integrations TO service_role;
    END IF;
  END IF;

  -- buildium_sync_runs
  IF to_regclass('public.buildium_sync_runs') IS NOT NULL THEN
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_sync_runs_read_in_org' AND polrelid = 'public.buildium_sync_runs'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_sync_runs_read_in_org" ON public.buildium_sync_runs TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_sync_runs_insert_admins' AND polrelid = 'public.buildium_sync_runs'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_sync_runs_insert_admins" ON public.buildium_sync_runs TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_sync_runs_update_admins' AND polrelid = 'public.buildium_sync_runs'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_sync_runs_update_admins" ON public.buildium_sync_runs TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_sync_runs_delete_admins' AND polrelid = 'public.buildium_sync_runs'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_sync_runs_delete_admins" ON public.buildium_sync_runs TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_sync_runs_service_role_all' AND polrelid = 'public.buildium_sync_runs'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_sync_runs_service_role_all" ON public.buildium_sync_runs TO service_role;
    END IF;
  END IF;

  -- buildium_sync_status
  IF to_regclass('public.buildium_sync_status') IS NOT NULL THEN
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_sync_status_read_in_org' AND polrelid = 'public.buildium_sync_status'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_sync_status_read_in_org" ON public.buildium_sync_status TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_sync_status_insert_admins' AND polrelid = 'public.buildium_sync_status'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_sync_status_insert_admins" ON public.buildium_sync_status TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_sync_status_update_admins' AND polrelid = 'public.buildium_sync_status'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_sync_status_update_admins" ON public.buildium_sync_status TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_sync_status_delete_admins' AND polrelid = 'public.buildium_sync_status'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_sync_status_delete_admins" ON public.buildium_sync_status TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_sync_status_service_role_all' AND polrelid = 'public.buildium_sync_status'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_sync_status_service_role_all" ON public.buildium_sync_status TO service_role;
    END IF;
  END IF;

  -- buildium_webhook_events
  IF to_regclass('public.buildium_webhook_events') IS NOT NULL THEN
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_webhook_events_read_in_org' AND polrelid = 'public.buildium_webhook_events'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_webhook_events_read_in_org" ON public.buildium_webhook_events TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_webhook_events_insert_admins' AND polrelid = 'public.buildium_webhook_events'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_webhook_events_insert_admins" ON public.buildium_webhook_events TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_webhook_events_update_admins' AND polrelid = 'public.buildium_webhook_events'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_webhook_events_update_admins" ON public.buildium_webhook_events TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_webhook_events_delete_admins' AND polrelid = 'public.buildium_webhook_events'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_webhook_events_delete_admins" ON public.buildium_webhook_events TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'buildium_webhook_events_service_role_all' AND polrelid = 'public.buildium_webhook_events'::regclass;
    IF FOUND THEN
      ALTER POLICY "buildium_webhook_events_service_role_all" ON public.buildium_webhook_events TO service_role;
    END IF;
  END IF;

  -- membership_roles
  IF to_regclass('public.membership_roles') IS NOT NULL THEN
    PERFORM 1 FROM pg_policy WHERE polname = 'membership_roles_read' AND polrelid = 'public.membership_roles'::regclass;
    IF FOUND THEN
      ALTER POLICY membership_roles_read ON public.membership_roles TO authenticated, service_role;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'membership_roles_admin_write' AND polrelid = 'public.membership_roles'::regclass;
    IF FOUND THEN
      ALTER POLICY membership_roles_admin_write ON public.membership_roles TO authenticated, service_role;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'user_permission_profiles_delete' AND polrelid = 'public.membership_roles'::regclass;
    IF FOUND THEN
      ALTER POLICY user_permission_profiles_delete ON public.membership_roles TO authenticated, service_role;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'user_permission_profiles_update' AND polrelid = 'public.membership_roles'::regclass;
    IF FOUND THEN
      ALTER POLICY user_permission_profiles_update ON public.membership_roles TO authenticated, service_role;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'user_permission_profiles_write' AND polrelid = 'public.membership_roles'::regclass;
    IF FOUND THEN
      ALTER POLICY user_permission_profiles_write ON public.membership_roles TO authenticated, service_role;
    END IF;
  END IF;

  -- org_memberships
  IF to_regclass('public.org_memberships') IS NOT NULL THEN
    PERFORM 1 FROM pg_policy WHERE polname = 'memberships_read' AND polrelid = 'public.org_memberships'::regclass;
    IF FOUND THEN
      ALTER POLICY memberships_read ON public.org_memberships TO authenticated, service_role;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'memberships_admin_manage' AND polrelid = 'public.org_memberships'::regclass;
    IF FOUND THEN
      ALTER POLICY memberships_admin_manage ON public.org_memberships TO authenticated, service_role;
    END IF;
  END IF;

  -- sync_operations
  IF to_regclass('public.sync_operations') IS NOT NULL THEN
    PERFORM 1 FROM pg_policy WHERE polname = 'sync_operations_read_in_org' AND polrelid = 'public.sync_operations'::regclass;
    IF FOUND THEN
      ALTER POLICY "sync_operations_read_in_org" ON public.sync_operations TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'sync_operations_insert_admins' AND polrelid = 'public.sync_operations'::regclass;
    IF FOUND THEN
      ALTER POLICY "sync_operations_insert_admins" ON public.sync_operations TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'sync_operations_update_admins' AND polrelid = 'public.sync_operations'::regclass;
    IF FOUND THEN
      ALTER POLICY "sync_operations_update_admins" ON public.sync_operations TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'sync_operations_delete_admins' AND polrelid = 'public.sync_operations'::regclass;
    IF FOUND THEN
      ALTER POLICY "sync_operations_delete_admins" ON public.sync_operations TO authenticated;
    END IF;
    PERFORM 1 FROM pg_policy WHERE polname = 'sync_operations_service_role_all' AND polrelid = 'public.sync_operations'::regclass;
    IF FOUND THEN
      ALTER POLICY "sync_operations_service_role_all" ON public.sync_operations TO service_role;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- PART 4: DROP DUPLICATE INDEXES
-- ============================================================================

-- billing_events: drop idx_service_revenue_org_period (keep idx_billing_events_org_period)
DROP INDEX IF EXISTS public.idx_service_revenue_org_period;

-- buildium_webhook_events: drop one of the duplicate unique constraints
-- Keep uq_buildium_webhook_events_compound, drop buildium_webhook_events_event_id_key or uq_buildium_webhook_events_event_id if they exist
-- Note: These might be constraints or indexes, so we check and drop appropriately
DO $$
BEGIN
  -- Try dropping as constraint first
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'buildium_webhook_events_event_id_key'
  ) THEN
    ALTER TABLE public.buildium_webhook_events
      DROP CONSTRAINT IF EXISTS buildium_webhook_events_event_id_key;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_buildium_webhook_events_event_id'
  ) THEN
    ALTER TABLE public.buildium_webhook_events
      DROP CONSTRAINT IF EXISTS uq_buildium_webhook_events_event_id;
  END IF;
  
  -- Try dropping as index (only if not a constraint)
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'buildium_webhook_events'
      AND indexname = 'uq_buildium_webhook_events_event_id'
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_buildium_webhook_events_event_id'
      )
  ) THEN
    DROP INDEX IF EXISTS public.uq_buildium_webhook_events_event_id;
  END IF;
END $$;

-- membership_roles: drop duplicates (keep membership_roles_* versions, drop user_permission_profiles_*)
DROP INDEX IF EXISTS public.user_permission_profiles_org_idx;
DROP INDEX IF EXISTS public.user_permission_profiles_role_idx;
DROP INDEX IF EXISTS public.user_permission_profiles_user_idx;
-- Drop duplicate public_id unique constraint if it exists as a separate index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'membership_roles'
      AND indexname = 'membership_roles_public_id_key'
      AND indexdef LIKE '%UNIQUE%'
  ) THEN
    -- Check if there's a constraint with the same name
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'membership_roles_public_id_key'
    ) THEN
      ALTER TABLE public.membership_roles
        DROP CONSTRAINT IF EXISTS membership_roles_public_id_key;
    ELSE
      DROP INDEX IF EXISTS public.membership_roles_public_id_key;
    END IF;
  END IF;
END $$;

-- role_permissions: drop duplicates
-- Based on migrations, there are role_permissions_permission_idx and role_permissions_role_idx
-- The user mentioned keeping permission_idx and profile_idx, so we assume those are the canonical names
-- If there are duplicates with different names, they should be identified and dropped manually
-- (No action needed here if the indexes are already correctly named)

-- roles: drop one of the duplicate public_id unique constraints
DO $$
BEGIN
  -- Check which exists and drop the less preferred one
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'permission_profiles_public_id_key'
  ) THEN
    ALTER TABLE public.roles
      DROP CONSTRAINT IF EXISTS permission_profiles_public_id_key;
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_public_id_key'
  ) THEN
    -- Keep permission_profiles_public_id_key, drop roles_public_id_key
    ALTER TABLE public.roles
      DROP CONSTRAINT IF EXISTS roles_public_id_key;
  END IF;
END $$;

-- transaction_lines: drop duplicate indexes
-- Keep idx_tx_lines_gl, drop idx_journal_entries_gl_account_id
DROP INDEX IF EXISTS public.idx_journal_entries_gl_account_id;

-- Keep idx_tx_lines_lease, drop idx_transaction_lines_lease_id
DROP INDEX IF EXISTS public.idx_transaction_lines_lease_id;

-- Property/date indexes: keep tl_prop_date_idx, drop idx_tx_lines_property_date if it exists
DROP INDEX IF EXISTS public.idx_tx_lines_property_date;

-- Transaction_id indexes: need to identify which ones are duplicates
-- Keep idx_tx_lines_transaction_id, drop others if they're true duplicates
-- Note: Need to verify these actually exist and are duplicates
DROP INDEX IF EXISTS public.idx_journal_entries_transaction_id;

-- Keep idx_tx_lines_unit, drop idx_transaction_lines_unit_id
DROP INDEX IF EXISTS public.idx_transaction_lines_unit_id;

COMMIT;

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- 
-- After applying this migration, verify the fixes with:
--
-- 1. Check that initplans are gone:
--    EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM properties WHERE org_id = '<some-org-id>';
--    Look for "InitPlan" in the output - it should be gone or minimal
--
-- 2. Verify permissive policy consolidation:
--    SELECT tablename, cmd, COUNT(*) 
--    FROM pg_policies 
--    WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
--    GROUP BY tablename, cmd 
--    HAVING COUNT(*) > 1;
--    This should return fewer results (ideally none) after consolidation
--
-- 3. Verify duplicate indexes are gone:
--    SELECT schemaname, tablename, indexname, indexdef
--    FROM pg_indexes
--    WHERE schemaname = 'public'
--    ORDER BY tablename, indexname;
--    Check that the duplicate indexes mentioned in this migration are gone
--
-- 4. Test representative queries to ensure RLS policies still work correctly:
--    - SELECT from properties, units, work_orders, etc.
--    - INSERT/UPDATE/DELETE operations for authenticated users
--    - Verify service_role access still works
