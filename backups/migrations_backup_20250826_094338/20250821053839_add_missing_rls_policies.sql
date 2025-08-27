-- Add RLS policies for missing tables
-- Migration: 20250821053839_add_missing_rls_policies.sql

-- Enable RLS on tables that don't have it yet
ALTER TABLE IF EXISTS public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ownerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.owners_list_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_ownerships_cache ENABLE ROW LEVEL SECURITY;

-- ==============================================================
-- CONTACTS TABLE POLICIES
-- ==============================================================

-- Allow authenticated users to view contacts
DROP POLICY IF EXISTS "contacts_read_policy" ON public.contacts;
CREATE POLICY "contacts_read_policy" ON public.contacts
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert contacts
DROP POLICY IF EXISTS "contacts_insert_policy" ON public.contacts;
CREATE POLICY "contacts_insert_policy" ON public.contacts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update contacts
DROP POLICY IF EXISTS "contacts_update_policy" ON public.contacts;
CREATE POLICY "contacts_update_policy" ON public.contacts
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete contacts
DROP POLICY IF EXISTS "contacts_delete_policy" ON public.contacts;
CREATE POLICY "contacts_delete_policy" ON public.contacts
    FOR DELETE USING (auth.role() = 'authenticated');

-- ==============================================================
-- OWNERSHIPS TABLE POLICIES
-- ==============================================================

-- Allow authenticated users to view ownerships
DROP POLICY IF EXISTS "ownerships_read_policy" ON public.ownerships;
CREATE POLICY "ownerships_read_policy" ON public.ownerships
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert ownerships
DROP POLICY IF EXISTS "ownerships_insert_policy" ON public.ownerships;
CREATE POLICY "ownerships_insert_policy" ON public.ownerships
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update ownerships
DROP POLICY IF EXISTS "ownerships_update_policy" ON public.ownerships;
CREATE POLICY "ownerships_update_policy" ON public.ownerships
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete ownerships
DROP POLICY IF EXISTS "ownerships_delete_policy" ON public.ownerships;
CREATE POLICY "ownerships_delete_policy" ON public.ownerships
    FOR DELETE USING (auth.role() = 'authenticated');

-- ==============================================================
-- OWNERS_LIST_CACHE TABLE POLICIES
-- ==============================================================

-- Allow authenticated users to view owners list cache
DROP POLICY IF EXISTS "owners_list_cache_read_policy" ON public.owners_list_cache;
CREATE POLICY "owners_list_cache_read_policy" ON public.owners_list_cache
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert owners list cache (for triggers)
DROP POLICY IF EXISTS "owners_list_cache_insert_policy" ON public.owners_list_cache;
CREATE POLICY "owners_list_cache_insert_policy" ON public.owners_list_cache
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update owners list cache (for triggers)
DROP POLICY IF EXISTS "owners_list_cache_update_policy" ON public.owners_list_cache;
CREATE POLICY "owners_list_cache_update_policy" ON public.owners_list_cache
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete owners list cache
DROP POLICY IF EXISTS "owners_list_cache_delete_policy" ON public.owners_list_cache;
CREATE POLICY "owners_list_cache_delete_policy" ON public.owners_list_cache
    FOR DELETE USING (auth.role() = 'authenticated');

-- ==============================================================
-- PROPERTY_OWNERSHIPS_CACHE TABLE POLICIES
-- ==============================================================

-- Allow authenticated users to view property ownerships cache
DROP POLICY IF EXISTS "property_ownerships_cache_read_policy" ON public.property_ownerships_cache;
CREATE POLICY "property_ownerships_cache_read_policy" ON public.property_ownerships_cache
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert property ownerships cache (for triggers)
DROP POLICY IF EXISTS "property_ownerships_cache_insert_policy" ON public.property_ownerships_cache;
CREATE POLICY "property_ownerships_cache_insert_policy" ON public.property_ownerships_cache
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update property ownerships cache (for triggers)
DROP POLICY IF EXISTS "property_ownerships_cache_update_policy" ON public.property_ownerships_cache;
CREATE POLICY "property_ownerships_cache_update_policy" ON public.property_ownerships_cache
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete property ownerships cache
DROP POLICY IF EXISTS "property_ownerships_cache_delete_policy" ON public.property_ownerships_cache;
CREATE POLICY "property_ownerships_cache_delete_policy" ON public.property_ownerships_cache
    FOR DELETE USING (auth.role() = 'authenticated');

-- ==============================================================
-- VERIFICATION
-- ==============================================================

-- Verify RLS is enabled on all tables
DO $$
DECLARE
    table_name text;
    rls_enabled boolean;
BEGIN
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('contacts', 'ownerships', 'owners_list_cache', 'property_ownerships_cache')
    LOOP
        SELECT rowsecurity INTO rls_enabled 
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = table_name;
        
        RAISE NOTICE 'Table %: RLS enabled = %', table_name, rls_enabled;
    END LOOP;
END $$;
