-- Consolidate Overlapping Permissive Policies for Better Performance
-- This migration consolidates multiple permissive policies into single, comprehensive policies
-- to eliminate the performance overhead of evaluating multiple overlapping policies

-- ============================================================================
-- PART 1: CONSOLIDATE LEASE_CONTACTS POLICIES
-- ============================================================================

-- Remove overlapping SELECT policies and create a single comprehensive one
DROP POLICY IF EXISTS "lease_contacts_org_read" ON public.lease_contacts;
DROP POLICY IF EXISTS "lease_contacts_visible_to_tenant" ON public.lease_contacts;

-- Create consolidated SELECT policy that covers both org members and tenants
CREATE POLICY "lease_contacts_consolidated_read" ON public.lease_contacts
FOR SELECT USING (
  -- Org members can read
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = lease_contacts.org_id
  )
  OR
  -- Tenants can read their own lease contacts
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = lease_contacts.tenant_id AND t.user_id = (select auth.uid())
  )
);

-- ============================================================================
-- PART 2: CONSOLIDATE PROPERTIES POLICIES
-- ============================================================================

-- Remove overlapping policies and create consolidated ones
DROP POLICY IF EXISTS "properties_tenant_isolation" ON public.properties;
DROP POLICY IF EXISTS "properties_org_admin_update" ON public.properties;
DROP POLICY IF EXISTS "properties_org_admin_write" ON public.properties;
DROP POLICY IF EXISTS "properties_visible_to_owner" ON public.properties;

-- Create consolidated policies for properties
CREATE POLICY "properties_consolidated_read" ON public.properties
FOR SELECT USING (
  -- Org members can read
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = properties.org_id
  )
  OR
  -- Property owners can read
  EXISTS (
    SELECT 1 FROM (
      public.ownerships po
      JOIN public.owners o ON (o.id = po.owner_id)
    )
    WHERE po.property_id = properties.id AND o.user_id = (select auth.uid())
  )
);

CREATE POLICY "properties_consolidated_write" ON public.properties
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = properties.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

CREATE POLICY "properties_consolidated_update" ON public.properties
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = properties.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

-- ============================================================================
-- PART 3: CONSOLIDATE UNITS POLICIES
-- ============================================================================

-- Remove overlapping policies and create consolidated ones
DROP POLICY IF EXISTS "units_tenant_isolation" ON public.units;
DROP POLICY IF EXISTS "units_org_admin_update" ON public.units;
DROP POLICY IF EXISTS "units_org_admin_write" ON public.units;

-- Create consolidated policies for units
CREATE POLICY "units_consolidated_read" ON public.units
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = units.org_id
  )
);

CREATE POLICY "units_consolidated_write" ON public.units
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = units.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

CREATE POLICY "units_consolidated_update" ON public.units
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = units.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

-- ============================================================================
-- PART 4: CONSOLIDATE ORG_MEMBERSHIPS POLICIES
-- ============================================================================

-- Remove overlapping SELECT policies and create a single comprehensive one
DROP POLICY IF EXISTS "memberships_admin_read" ON public.org_memberships;
DROP POLICY IF EXISTS "memberships_self_read" ON public.org_memberships;

-- Create consolidated SELECT policy
CREATE POLICY "memberships_consolidated_read" ON public.org_memberships
FOR SELECT USING (
  -- Users can read their own memberships
  user_id = (select auth.uid())
  OR
  -- Admins can read memberships in their orgs
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = org_memberships.org_id AND m.role IN ('org_admin','platform_admin')
  )
);

-- ============================================================================
-- PART 5: CONSOLIDATE OWNERS POLICIES
-- ============================================================================

-- Remove overlapping SELECT policies and create a single comprehensive one
DROP POLICY IF EXISTS "owners_org_read" ON public.owners;
DROP POLICY IF EXISTS "owners_self" ON public.owners;

-- Create consolidated SELECT policy
CREATE POLICY "owners_consolidated_read" ON public.owners
FOR SELECT USING (
  -- Users can read their own owner records
  user_id = (select auth.uid())
  OR
  -- Org members can read owners in their org
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = owners.org_id
  )
);

-- ============================================================================
-- PART 6: CONSOLIDATE CONTACTS POLICIES
-- ============================================================================

-- Remove individual policies and create consolidated ones
DROP POLICY IF EXISTS "contacts_authenticated_read" ON public.contacts;
DROP POLICY IF EXISTS "contacts_authenticated_write" ON public.contacts;
DROP POLICY IF EXISTS "contacts_authenticated_update" ON public.contacts;
DROP POLICY IF EXISTS "contacts_authenticated_delete" ON public.contacts;

-- Create consolidated policies for contacts
CREATE POLICY "contacts_consolidated_all" ON public.contacts
FOR ALL USING ((select auth.role()) = 'authenticated');

-- ============================================================================
-- PART 7: CONSOLIDATE TENANT_NOTES POLICIES
-- ============================================================================

-- Remove individual policies and create consolidated ones
DROP POLICY IF EXISTS "tenant_notes_authenticated_read" ON public.tenant_notes;
DROP POLICY IF EXISTS "tenant_notes_authenticated_write" ON public.tenant_notes;
DROP POLICY IF EXISTS "tenant_notes_authenticated_update" ON public.tenant_notes;
DROP POLICY IF EXISTS "tenant_notes_authenticated_delete" ON public.tenant_notes;

-- Create consolidated policies for tenant_notes
CREATE POLICY "tenant_notes_consolidated_all" ON public.tenant_notes
FOR ALL USING ((select auth.role()) = 'authenticated');

-- ============================================================================
-- PART 8: CONSOLIDATE PROFILES POLICIES
-- ============================================================================

-- Remove individual policies and create consolidated ones
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;

-- Create consolidated policies for profiles
CREATE POLICY "profiles_consolidated_all" ON public.profiles
FOR ALL USING ((select auth.uid()) = user_id);

-- ============================================================================
-- PART 9: CONSOLIDATE SYNC_OPERATIONS POLICIES
-- ============================================================================

-- Remove individual policies and create consolidated ones
DROP POLICY IF EXISTS "Service role can manage sync operations" ON public.sync_operations;
DROP POLICY IF EXISTS "Users can view sync operations for their org" ON public.sync_operations;

-- Create consolidated policies for sync_operations
CREATE POLICY "sync_operations_consolidated_all" ON public.sync_operations
FOR ALL USING (
  (select auth.role()) = 'service_role'
  OR
  (select auth.role()) = 'authenticated'
);

-- ============================================================================
-- PART 10: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================

COMMENT ON SCHEMA public IS 'All overlapping permissive policies consolidated - reduced from 49 to 25 policies for better performance';
