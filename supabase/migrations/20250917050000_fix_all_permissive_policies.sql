-- Fix ALL Multiple Permissive Policies Performance Issues
-- This migration removes all overlapping permissive policies and replaces them with proper org-scoped policies
-- where needed, eliminating the performance degradation from multiple permissive policies

-- ============================================================================
-- PART 1: REMOVE ALL OVERLAPPING PERMISSIVE POLICIES
-- ============================================================================

-- appliance_service_history: Remove all permissive policies
DROP POLICY IF EXISTS "appliance_service_history_delete" ON public.appliance_service_history;
DROP POLICY IF EXISTS "appliance_service_history_insert" ON public.appliance_service_history;
DROP POLICY IF EXISTS "appliance_service_history_read" ON public.appliance_service_history;
DROP POLICY IF EXISTS "appliance_service_history_update" ON public.appliance_service_history;

-- bill_categories: Remove all permissive policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.bill_categories;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.bill_categories;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.bill_categories;

-- buildium_api_cache: Remove all permissive policies
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.buildium_api_cache;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.buildium_api_cache;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.buildium_api_cache;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.buildium_api_cache;

-- buildium_api_log: Remove all permissive policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.buildium_api_log;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.buildium_api_log;

-- buildium_sync_status: Remove all permissive policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.buildium_sync_status;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.buildium_sync_status;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.buildium_sync_status;

-- buildium_webhook_events: Remove all permissive policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.buildium_webhook_events;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.buildium_webhook_events;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.buildium_webhook_events;

-- contacts: Remove overlapping permissive policies (keep org-scoped ones)
DROP POLICY IF EXISTS "contacts_delete_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_read_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_policy" ON public.contacts;

-- gl_accounts: Remove overlapping permissive policies (keep org-scoped ones)
DROP POLICY IF EXISTS "gl_accounts_delete_policy" ON public.gl_accounts;
DROP POLICY IF EXISTS "gl_accounts_insert_policy" ON public.gl_accounts;
DROP POLICY IF EXISTS "gl_accounts_read_policy" ON public.gl_accounts;
DROP POLICY IF EXISTS "gl_accounts_update_policy" ON public.gl_accounts;

-- lease_contacts: Remove overlapping permissive policies (keep org-scoped ones)
DROP POLICY IF EXISTS "lease_contacts_delete_policy" ON public.lease_contacts;
DROP POLICY IF EXISTS "lease_contacts_insert_policy" ON public.lease_contacts;
DROP POLICY IF EXISTS "lease_contacts_read_policy" ON public.lease_contacts;
DROP POLICY IF EXISTS "lease_contacts_update_policy" ON public.lease_contacts;

-- owners_list_cache: Remove ALL overlapping policies (both old and new)
DROP POLICY IF EXISTS "Owners list cache delete policy" ON public.owners_list_cache;
DROP POLICY IF EXISTS "Owners list cache insert policy" ON public.owners_list_cache;
DROP POLICY IF EXISTS "Owners list cache read policy" ON public.owners_list_cache;
DROP POLICY IF EXISTS "Owners list cache update policy" ON public.owners_list_cache;
DROP POLICY IF EXISTS "owners_list_cache_delete_policy" ON public.owners_list_cache;
DROP POLICY IF EXISTS "owners_list_cache_insert_policy" ON public.owners_list_cache;
DROP POLICY IF EXISTS "owners_list_cache_read_policy" ON public.owners_list_cache;
DROP POLICY IF EXISTS "owners_list_cache_update_policy" ON public.owners_list_cache;

-- ownerships: Remove overlapping permissive policies (keep org-scoped ones)
DROP POLICY IF EXISTS "ownerships_delete_policy" ON public.ownerships;
DROP POLICY IF EXISTS "ownerships_insert_policy" ON public.ownerships;
DROP POLICY IF EXISTS "ownerships_read_policy" ON public.ownerships;
DROP POLICY IF EXISTS "ownerships_update_policy" ON public.ownerships;

-- property_ownerships_cache: Remove ALL overlapping policies (both old and new)
DROP POLICY IF EXISTS "Property ownerships cache delete policy" ON public.property_ownerships_cache;
DROP POLICY IF EXISTS "Property ownerships cache insert policy" ON public.property_ownerships_cache;
DROP POLICY IF EXISTS "Property ownerships cache read policy" ON public.property_ownerships_cache;
DROP POLICY IF EXISTS "Property ownerships cache update policy" ON public.property_ownerships_cache;
DROP POLICY IF EXISTS "property_ownerships_cache_delete_policy" ON public.property_ownerships_cache;
DROP POLICY IF EXISTS "property_ownerships_cache_insert_policy" ON public.property_ownerships_cache;
DROP POLICY IF EXISTS "property_ownerships_cache_read_policy" ON public.property_ownerships_cache;
DROP POLICY IF EXISTS "property_ownerships_cache_update_policy" ON public.property_ownerships_cache;

-- task_categories: Remove all permissive policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.task_categories;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.task_categories;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.task_categories;

-- task_history: Remove all permissive policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.task_history;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.task_history;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.task_history;

-- task_history_files: Remove all permissive policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.task_history_files;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.task_history_files;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.task_history_files;

-- tenant_notes: Remove overlapping permissive policies (keep org-scoped ones)
DROP POLICY IF EXISTS "tenant_notes_delete_policy" ON public.tenant_notes;
DROP POLICY IF EXISTS "tenant_notes_insert_policy" ON public.tenant_notes;
DROP POLICY IF EXISTS "tenant_notes_read_policy" ON public.tenant_notes;
DROP POLICY IF EXISTS "tenant_notes_update_policy" ON public.tenant_notes;

-- tenants: Remove overlapping permissive policies (keep org-scoped ones)
DROP POLICY IF EXISTS "tenants_delete_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_read_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_policy" ON public.tenants;

-- vendor_categories: Remove all permissive policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.vendor_categories;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.vendor_categories;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.vendor_categories;

-- ============================================================================
-- PART 2: ADD PROPER ORG-SCOPED POLICIES WHERE NEEDED
-- ============================================================================

-- contacts: Add simple authenticated user policies (no org_id column)
CREATE POLICY "contacts_authenticated_read" ON public.contacts
FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "contacts_authenticated_write" ON public.contacts
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "contacts_authenticated_update" ON public.contacts
FOR UPDATE USING ((select auth.role()) = 'authenticated');

CREATE POLICY "contacts_authenticated_delete" ON public.contacts
FOR DELETE USING ((select auth.role()) = 'authenticated');

-- gl_accounts: Add proper org-scoped policies (if not already present)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gl_accounts' AND policyname = 'gl_accounts_org_read') THEN
    CREATE POLICY "gl_accounts_org_read" ON public.gl_accounts
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = gl_accounts.org_id
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gl_accounts' AND policyname = 'gl_accounts_org_write') THEN
    CREATE POLICY "gl_accounts_org_write" ON public.gl_accounts
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = gl_accounts.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gl_accounts' AND policyname = 'gl_accounts_org_update') THEN
    CREATE POLICY "gl_accounts_org_update" ON public.gl_accounts
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = gl_accounts.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
      )
    );
  END IF;
END $$;

-- lease_contacts: Add proper org-scoped policies (if not already present)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lease_contacts' AND policyname = 'lease_contacts_org_read') THEN
    CREATE POLICY "lease_contacts_org_read" ON public.lease_contacts
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = lease_contacts.org_id
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lease_contacts' AND policyname = 'lease_contacts_org_write') THEN
    CREATE POLICY "lease_contacts_org_write" ON public.lease_contacts
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = lease_contacts.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lease_contacts' AND policyname = 'lease_contacts_org_update') THEN
    CREATE POLICY "lease_contacts_org_update" ON public.lease_contacts
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = lease_contacts.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
      )
    );
  END IF;
END $$;

-- ownerships: Add proper org-scoped policies (if not already present)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ownerships' AND policyname = 'ownerships_org_read') THEN
    CREATE POLICY "ownerships_org_read" ON public.ownerships
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = ownerships.org_id
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ownerships' AND policyname = 'ownerships_org_write') THEN
    CREATE POLICY "ownerships_org_write" ON public.ownerships
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = ownerships.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ownerships' AND policyname = 'ownerships_org_update') THEN
    CREATE POLICY "ownerships_org_update" ON public.ownerships
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = ownerships.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
      )
    );
  END IF;
END $$;

-- tenant_notes: Add simple authenticated user policies (no org_id column)
CREATE POLICY "tenant_notes_authenticated_read" ON public.tenant_notes
FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "tenant_notes_authenticated_write" ON public.tenant_notes
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "tenant_notes_authenticated_update" ON public.tenant_notes
FOR UPDATE USING ((select auth.role()) = 'authenticated');

CREATE POLICY "tenant_notes_authenticated_delete" ON public.tenant_notes
FOR DELETE USING ((select auth.role()) = 'authenticated');

-- tenants: Add proper org-scoped policies (if not already present)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenants' AND policyname = 'tenants_org_read') THEN
    CREATE POLICY "tenants_org_read" ON public.tenants
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = tenants.org_id
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenants' AND policyname = 'tenants_org_write') THEN
    CREATE POLICY "tenants_org_write" ON public.tenants
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = tenants.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenants' AND policyname = 'tenants_org_update') THEN
    CREATE POLICY "tenants_org_update" ON public.tenants
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = (select auth.uid()) AND m.org_id = tenants.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
      )
    );
  END IF;
END $$;

-- ============================================================================
-- PART 3: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================

COMMENT ON SCHEMA public IS 'All Multiple Permissive Policies issues fixed - removed 71 overlapping permissive policies, added proper org-scoped policies where needed';
