-- Fix Remaining Auth RLS Initialization Plan Performance Issues
-- This migration optimizes all remaining direct auth.uid() calls to use (select auth.uid()) pattern
-- and removes overlapping policies that cause performance degradation

-- ============================================================================
-- PART 1: REMOVE OVERLAPPING POLICIES (Keep only the optimized ones)
-- ============================================================================

-- gl_accounts: Remove overlapping policies
DROP POLICY IF EXISTS "gl_accounts_read_in_org" ON public.gl_accounts;
DROP POLICY IF EXISTS "gl_accounts_update_admins" ON public.gl_accounts;
DROP POLICY IF EXISTS "gl_accounts_write_admins" ON public.gl_accounts;

-- lease_contacts: Remove overlapping policies
DROP POLICY IF EXISTS "lease_contacts_read_in_org" ON public.lease_contacts;
DROP POLICY IF EXISTS "lease_contacts_update_admins" ON public.lease_contacts;
DROP POLICY IF EXISTS "lease_contacts_write_admins" ON public.lease_contacts;

-- ownerships: Remove overlapping policies
DROP POLICY IF EXISTS "ownerships_read_in_org" ON public.ownerships;
DROP POLICY IF EXISTS "ownerships_update_admins" ON public.ownerships;
DROP POLICY IF EXISTS "ownerships_write_admins" ON public.ownerships;

-- tenants: Remove overlapping policies
DROP POLICY IF EXISTS "tenants_read_in_org" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_admins" ON public.tenants;
DROP POLICY IF EXISTS "tenants_write_admins" ON public.tenants;

-- org_memberships: Remove overlapping policy
DROP POLICY IF EXISTS "select my memberships" ON public.org_memberships;

-- ============================================================================
-- PART 2: OPTIMIZE REMAINING POLICIES WITH DIRECT auth.uid() CALLS
-- ============================================================================

-- bank_accounts: Optimize remaining policies
DROP POLICY IF EXISTS "bank_accounts_org_read" ON public.bank_accounts;
CREATE POLICY "bank_accounts_org_read" ON public.bank_accounts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = bank_accounts.org_id
  )
);

DROP POLICY IF EXISTS "bank_accounts_org_update" ON public.bank_accounts;
CREATE POLICY "bank_accounts_org_update" ON public.bank_accounts
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = bank_accounts.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "bank_accounts_org_write" ON public.bank_accounts;
CREATE POLICY "bank_accounts_org_write" ON public.bank_accounts
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = bank_accounts.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

-- gl_accounts: Optimize remaining policies
DROP POLICY IF EXISTS "gl_accounts_org_read" ON public.gl_accounts;
CREATE POLICY "gl_accounts_org_read" ON public.gl_accounts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = gl_accounts.org_id
  )
);

DROP POLICY IF EXISTS "gl_accounts_org_update" ON public.gl_accounts;
CREATE POLICY "gl_accounts_org_update" ON public.gl_accounts
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = gl_accounts.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "gl_accounts_org_write" ON public.gl_accounts;
CREATE POLICY "gl_accounts_org_write" ON public.gl_accounts
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = gl_accounts.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

-- lease_contacts: Optimize remaining policies
DROP POLICY IF EXISTS "lease_contacts_org_read" ON public.lease_contacts;
CREATE POLICY "lease_contacts_org_read" ON public.lease_contacts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = lease_contacts.org_id
  )
);

DROP POLICY IF EXISTS "lease_contacts_org_update" ON public.lease_contacts;
CREATE POLICY "lease_contacts_org_update" ON public.lease_contacts
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = lease_contacts.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "lease_contacts_org_write" ON public.lease_contacts;
CREATE POLICY "lease_contacts_org_write" ON public.lease_contacts
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = lease_contacts.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "lease_contacts_visible_to_tenant" ON public.lease_contacts;
CREATE POLICY "lease_contacts_visible_to_tenant" ON public.lease_contacts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = lease_contacts.tenant_id AND t.user_id = (select auth.uid())
  )
);

-- org_memberships: Optimize remaining policies
DROP POLICY IF EXISTS "memberships_admin_read" ON public.org_memberships;
CREATE POLICY "memberships_admin_read" ON public.org_memberships
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = org_memberships.org_id AND m.role IN ('org_admin','platform_admin')
  )
);

DROP POLICY IF EXISTS "memberships_admin_update" ON public.org_memberships;
CREATE POLICY "memberships_admin_update" ON public.org_memberships
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = org_memberships.org_id AND m.role IN ('org_admin','platform_admin')
  )
);

DROP POLICY IF EXISTS "memberships_admin_write" ON public.org_memberships;
CREATE POLICY "memberships_admin_write" ON public.org_memberships
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = org_memberships.org_id AND m.role IN ('org_admin','platform_admin')
  )
);

DROP POLICY IF EXISTS "memberships_self_read" ON public.org_memberships;
CREATE POLICY "memberships_self_read" ON public.org_memberships
FOR SELECT USING (user_id = (select auth.uid()));

-- owners: Optimize remaining policies
DROP POLICY IF EXISTS "owners_org_read" ON public.owners;
CREATE POLICY "owners_org_read" ON public.owners
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = owners.org_id
  )
);

DROP POLICY IF EXISTS "owners_org_update" ON public.owners;
CREATE POLICY "owners_org_update" ON public.owners
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = owners.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "owners_org_write" ON public.owners;
CREATE POLICY "owners_org_write" ON public.owners
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = owners.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "owners_self" ON public.owners;
CREATE POLICY "owners_self" ON public.owners
FOR SELECT USING (
  (user_id = (select auth.uid())) OR (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid()) AND m.org_id = owners.org_id
    )
  )
);

-- ownerships: Optimize remaining policies
DROP POLICY IF EXISTS "ownerships_org_read" ON public.ownerships;
CREATE POLICY "ownerships_org_read" ON public.ownerships
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = ownerships.org_id
  )
);

DROP POLICY IF EXISTS "ownerships_org_update" ON public.ownerships;
CREATE POLICY "ownerships_org_update" ON public.ownerships
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = ownerships.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "ownerships_org_write" ON public.ownerships;
CREATE POLICY "ownerships_org_write" ON public.ownerships
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = ownerships.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

-- profiles: Optimize remaining policies
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
CREATE POLICY "read own profile" ON public.profiles
FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "update own profile" ON public.profiles;
CREATE POLICY "update own profile" ON public.profiles
FOR UPDATE USING ((select auth.uid()) = user_id);

-- properties: Optimize remaining policies
DROP POLICY IF EXISTS "properties_org_admin_update" ON public.properties;
CREATE POLICY "properties_org_admin_update" ON public.properties
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = properties.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "properties_org_admin_write" ON public.properties;
CREATE POLICY "properties_org_admin_write" ON public.properties
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = properties.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "properties_tenant_isolation" ON public.properties;
CREATE POLICY "properties_tenant_isolation" ON public.properties
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = properties.org_id
  )
);

DROP POLICY IF EXISTS "properties_visible_to_owner" ON public.properties;
CREATE POLICY "properties_visible_to_owner" ON public.properties
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM (
      public.ownerships po
      JOIN public.owners o ON (o.id = po.owner_id)
    )
    WHERE po.property_id = properties.id AND o.user_id = (select auth.uid())
  )
);

-- reconciliation_log: Optimize remaining policy
DROP POLICY IF EXISTS "rl_org_read" ON public.reconciliation_log;
CREATE POLICY "rl_org_read" ON public.reconciliation_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM (
      public.properties p
      JOIN public.org_memberships m ON (m.org_id = p.org_id)
    )
    WHERE p.id = reconciliation_log.property_id AND m.user_id = (select auth.uid())
  )
);

-- tenants: Optimize remaining policies
DROP POLICY IF EXISTS "tenants_org_read" ON public.tenants;
CREATE POLICY "tenants_org_read" ON public.tenants
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = tenants.org_id
  )
);

DROP POLICY IF EXISTS "tenants_org_update" ON public.tenants;
CREATE POLICY "tenants_org_update" ON public.tenants
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = tenants.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "tenants_org_write" ON public.tenants;
CREATE POLICY "tenants_org_write" ON public.tenants
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = tenants.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

-- transactions: Optimize remaining policies
DROP POLICY IF EXISTS "transactions_org_read" ON public.transactions;
CREATE POLICY "transactions_org_read" ON public.transactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = transactions.org_id
  )
);

DROP POLICY IF EXISTS "transactions_org_update" ON public.transactions;
CREATE POLICY "transactions_org_update" ON public.transactions
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = transactions.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "transactions_org_write" ON public.transactions;
CREATE POLICY "transactions_org_write" ON public.transactions
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = transactions.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

-- units: Optimize remaining policies
DROP POLICY IF EXISTS "units_org_admin_update" ON public.units;
CREATE POLICY "units_org_admin_update" ON public.units
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = units.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "units_org_admin_write" ON public.units;
CREATE POLICY "units_org_admin_write" ON public.units
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = units.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "units_tenant_isolation" ON public.units;
CREATE POLICY "units_tenant_isolation" ON public.units
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = units.org_id
  )
);

-- work_orders: Optimize remaining policies
DROP POLICY IF EXISTS "work_orders_org_read" ON public.work_orders;
CREATE POLICY "work_orders_org_read" ON public.work_orders
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = work_orders.org_id
  )
);

DROP POLICY IF EXISTS "work_orders_org_update" ON public.work_orders;
CREATE POLICY "work_orders_org_update" ON public.work_orders
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = work_orders.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

DROP POLICY IF EXISTS "work_orders_org_write" ON public.work_orders;
CREATE POLICY "work_orders_org_write" ON public.work_orders
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = (select auth.uid()) AND m.org_id = work_orders.org_id AND m.role IN ('org_admin','org_manager','platform_admin')
  )
);

-- ============================================================================
-- PART 3: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================

COMMENT ON SCHEMA public IS 'All Auth RLS Initialization Plan issues fixed - all auth functions use (select auth.function()) pattern to prevent per-row evaluation';
