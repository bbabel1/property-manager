-- Fix Auth RLS Initialization Plan performance issues
-- Replace direct auth.role() and auth.uid() calls with (select auth.function()) pattern
-- This eliminates per-row evaluation during query planning

-- 1. Fix contacts table policies
DROP POLICY IF EXISTS "contacts_delete_policy" ON public.contacts;
CREATE POLICY "contacts_delete_policy" ON public.contacts
FOR DELETE USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "contacts_insert_policy" ON public.contacts;
CREATE POLICY "contacts_insert_policy" ON public.contacts
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "contacts_read_policy" ON public.contacts;
CREATE POLICY "contacts_read_policy" ON public.contacts
FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "contacts_update_policy" ON public.contacts;
CREATE POLICY "contacts_update_policy" ON public.contacts
FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- 2. Fix gl_accounts table policies
DROP POLICY IF EXISTS "gl_accounts_delete_policy" ON public.gl_accounts;
CREATE POLICY "gl_accounts_delete_policy" ON public.gl_accounts
FOR DELETE USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "gl_accounts_insert_policy" ON public.gl_accounts;
CREATE POLICY "gl_accounts_insert_policy" ON public.gl_accounts
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "gl_accounts_read_policy" ON public.gl_accounts;
CREATE POLICY "gl_accounts_read_policy" ON public.gl_accounts
FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "gl_accounts_update_policy" ON public.gl_accounts;
CREATE POLICY "gl_accounts_update_policy" ON public.gl_accounts
FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- 3. Fix lease_contacts table policies
DROP POLICY IF EXISTS "lease_contacts_delete_policy" ON public.lease_contacts;
CREATE POLICY "lease_contacts_delete_policy" ON public.lease_contacts
FOR DELETE USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "lease_contacts_insert_policy" ON public.lease_contacts;
CREATE POLICY "lease_contacts_insert_policy" ON public.lease_contacts
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "lease_contacts_read_policy" ON public.lease_contacts;
CREATE POLICY "lease_contacts_read_policy" ON public.lease_contacts
FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "lease_contacts_update_policy" ON public.lease_contacts;
CREATE POLICY "lease_contacts_update_policy" ON public.lease_contacts
FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- 4. Fix owners_list_cache table policies
DROP POLICY IF EXISTS "owners_list_cache_delete_policy" ON public.owners_list_cache;
CREATE POLICY "owners_list_cache_delete_policy" ON public.owners_list_cache
FOR DELETE USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "owners_list_cache_insert_policy" ON public.owners_list_cache;
CREATE POLICY "owners_list_cache_insert_policy" ON public.owners_list_cache
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "owners_list_cache_read_policy" ON public.owners_list_cache;
CREATE POLICY "owners_list_cache_read_policy" ON public.owners_list_cache
FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "owners_list_cache_update_policy" ON public.owners_list_cache;
CREATE POLICY "owners_list_cache_update_policy" ON public.owners_list_cache
FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- 5. Fix ownerships table policies
DROP POLICY IF EXISTS "ownerships_delete_policy" ON public.ownerships;
CREATE POLICY "ownerships_delete_policy" ON public.ownerships
FOR DELETE USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "ownerships_insert_policy" ON public.ownerships;
CREATE POLICY "ownerships_insert_policy" ON public.ownerships
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "ownerships_read_policy" ON public.ownerships;
CREATE POLICY "ownerships_read_policy" ON public.ownerships
FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "ownerships_update_policy" ON public.ownerships;
CREATE POLICY "ownerships_update_policy" ON public.ownerships
FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- 6. Fix property_ownerships_cache table policies
DROP POLICY IF EXISTS "property_ownerships_cache_delete_policy" ON public.property_ownerships_cache;
CREATE POLICY "property_ownerships_cache_delete_policy" ON public.property_ownerships_cache
FOR DELETE USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "property_ownerships_cache_insert_policy" ON public.property_ownerships_cache;
CREATE POLICY "property_ownerships_cache_insert_policy" ON public.property_ownerships_cache
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "property_ownerships_cache_read_policy" ON public.property_ownerships_cache;
CREATE POLICY "property_ownerships_cache_read_policy" ON public.property_ownerships_cache
FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "property_ownerships_cache_update_policy" ON public.property_ownerships_cache;
CREATE POLICY "property_ownerships_cache_update_policy" ON public.property_ownerships_cache
FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- 7. Fix tenants table policies
DROP POLICY IF EXISTS "tenants_delete_policy" ON public.tenants;
CREATE POLICY "tenants_delete_policy" ON public.tenants
FOR DELETE USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "tenants_insert_policy" ON public.tenants;
CREATE POLICY "tenants_insert_policy" ON public.tenants
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "tenants_read_policy" ON public.tenants;
CREATE POLICY "tenants_read_policy" ON public.tenants
FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "tenants_update_policy" ON public.tenants;
CREATE POLICY "tenants_update_policy" ON public.tenants
FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- 8. Fix bank_accounts policies that still use direct auth.role()
DROP POLICY IF EXISTS "Allow authenticated users to delete bank accounts" ON public.bank_accounts;
CREATE POLICY "Allow authenticated users to delete bank accounts" ON public.bank_accounts
FOR DELETE USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to insert bank accounts" ON public.bank_accounts;
CREATE POLICY "Allow authenticated users to insert bank accounts" ON public.bank_accounts
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to update bank accounts" ON public.bank_accounts;
CREATE POLICY "Allow authenticated users to update bank accounts" ON public.bank_accounts
FOR UPDATE USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to view bank accounts" ON public.bank_accounts;
CREATE POLICY "Allow authenticated users to view bank accounts" ON public.bank_accounts
FOR SELECT USING ((select auth.role()) = 'authenticated');

-- 9. Fix sync_operations policies
DROP POLICY IF EXISTS "Users can view sync operations for their org" ON public.sync_operations;
CREATE POLICY "Users can view sync operations for their org" ON public.sync_operations
FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage sync operations" ON public.sync_operations;
CREATE POLICY "Service role can manage sync operations" ON public.sync_operations
FOR ALL USING ((select auth.role()) = 'service_role');

-- 10. Fix reconciliation_log policies (if org_id column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reconciliation_log' 
    AND column_name = 'org_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "rl_org_read" ON public.reconciliation_log';
    EXECUTE 'CREATE POLICY "rl_org_read" ON public.reconciliation_log
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = reconciliation_log.org_id
        )
      )';
  ELSE
    -- If no org_id column, use simple authenticated check
    EXECUTE 'DROP POLICY IF EXISTS "rl_org_read" ON public.reconciliation_log';
    EXECUTE 'CREATE POLICY "rl_org_read" ON public.reconciliation_log
      FOR SELECT USING ((select auth.role()) = ''authenticated'')';
  END IF;
END $$;

-- 11. Fix storage policies (if they exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "storage_read_org" ON storage.objects';
      EXECUTE 'CREATE POLICY "storage_read_org" ON storage.objects
        FOR SELECT USING (
          bucket_id = ''app'' AND EXISTS (
            SELECT 1 FROM public.org_memberships m
            WHERE m.user_id = (select auth.uid())
              AND m.org_id::text = split_part(storage.objects.name, ''/'', 2)
          )
        )';
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "storage_write_org" ON storage.objects';
      EXECUTE 'CREATE POLICY "storage_write_org" ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = ''app'' AND EXISTS (
            SELECT 1 FROM public.org_memberships m
            WHERE m.user_id = (select auth.uid())
              AND m.org_id::text = split_part(name, ''/'', 2)
              AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
          )
        )';
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;

-- 12. Fix is_platform_admin function
DROP FUNCTION IF EXISTS public.is_platform_admin(uuid);
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = COALESCE(p_user_id, (select auth.uid()))
      AND m.role = 'platform_admin'
  );
$$;
