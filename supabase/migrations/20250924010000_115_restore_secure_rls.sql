-- Restore secure, org-scoped RLS policies after temporary allow-all policies.
-- This migration removes overly permissive policies introduced in 20250924000002/03
-- and reinstates scoped policies tied to organization membership and roles.

begin;

-- Helper comment: roles allowed to manage data.
-- org_admin/org_manager/platform_admin retain write access; all org members retain read access.

------------------------------
-- PROPERTIES
------------------------------
DROP POLICY IF EXISTS "properties_allow_all" ON public.properties;
DROP POLICY IF EXISTS "properties_authenticated_update" ON public.properties;
DROP POLICY IF EXISTS "properties_authenticated_insert" ON public.properties;

CREATE POLICY "properties_org_member_read" ON public.properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.properties.org_id
    )
  );

CREATE POLICY "properties_org_admin_update" ON public.properties
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.properties.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.properties.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "properties_org_admin_insert" ON public.properties
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.properties.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

-- Allow property owners that have portal access to view their properties.
CREATE POLICY "properties_visible_to_owner" ON public.properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ownerships po
      JOIN public.owners o ON o.id = po.owner_id
      WHERE po.property_id = public.properties.id
        AND o.user_id = (select auth.uid())
    )
  );

------------------------------
-- UNITS
------------------------------
DROP POLICY IF EXISTS "units_allow_all" ON public.units;
DROP POLICY IF EXISTS "units_authenticated_update" ON public.units;
DROP POLICY IF EXISTS "units_authenticated_insert" ON public.units;

CREATE POLICY "units_org_member_read" ON public.units
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.units.org_id
    )
  );

CREATE POLICY "units_org_admin_update" ON public.units
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.units.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.units.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "units_org_admin_insert" ON public.units
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.units.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

------------------------------
-- BANK ACCOUNTS
------------------------------
DROP POLICY IF EXISTS "bank_accounts_allow_all" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_authenticated_update" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_authenticated_insert" ON public.bank_accounts;

CREATE POLICY "bank_accounts_org_member_read" ON public.bank_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.bank_accounts.org_id
    )
  );

CREATE POLICY "bank_accounts_org_admin_update" ON public.bank_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.bank_accounts.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.bank_accounts.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "bank_accounts_org_admin_insert" ON public.bank_accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.bank_accounts.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

------------------------------
-- GL ACCOUNTS
------------------------------
DROP POLICY IF EXISTS "gl_accounts_allow_all" ON public.gl_accounts;
DROP POLICY IF EXISTS "gl_accounts_authenticated_update" ON public.gl_accounts;
DROP POLICY IF EXISTS "gl_accounts_authenticated_insert" ON public.gl_accounts;

CREATE POLICY "gl_accounts_org_member_read" ON public.gl_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.gl_accounts.org_id
    )
  );

CREATE POLICY "gl_accounts_org_admin_update" ON public.gl_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.gl_accounts.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.gl_accounts.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "gl_accounts_org_admin_insert" ON public.gl_accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.gl_accounts.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

------------------------------
-- TRANSACTIONS
------------------------------
DROP POLICY IF EXISTS "transactions_allow_all" ON public.transactions;
DROP POLICY IF EXISTS "transactions_authenticated_update" ON public.transactions;
DROP POLICY IF EXISTS "transactions_authenticated_insert" ON public.transactions;

CREATE POLICY "transactions_org_member_read" ON public.transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.transactions.org_id
    )
  );

CREATE POLICY "transactions_org_admin_update" ON public.transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.transactions.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.transactions.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "transactions_org_admin_insert" ON public.transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.transactions.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

------------------------------
-- WORK ORDERS
------------------------------
DROP POLICY IF EXISTS "work_orders_allow_all" ON public.work_orders;
DROP POLICY IF EXISTS "work_orders_authenticated_update" ON public.work_orders;
DROP POLICY IF EXISTS "work_orders_authenticated_insert" ON public.work_orders;

CREATE POLICY "work_orders_org_member_read" ON public.work_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.work_orders.org_id
    )
  );

CREATE POLICY "work_orders_org_admin_update" ON public.work_orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.work_orders.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.work_orders.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "work_orders_org_admin_insert" ON public.work_orders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.work_orders.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

------------------------------
-- TENANTS
------------------------------
DROP POLICY IF EXISTS "tenants_allow_all" ON public.tenants;
DROP POLICY IF EXISTS "tenants_authenticated_update" ON public.tenants;
DROP POLICY IF EXISTS "tenants_authenticated_insert" ON public.tenants;

CREATE POLICY "tenants_org_member_read" ON public.tenants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.tenants.org_id
    )
  );

CREATE POLICY "tenants_org_admin_update" ON public.tenants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.tenants.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.tenants.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "tenants_org_admin_insert" ON public.tenants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.tenants.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

------------------------------
-- LEASE CONTACTS
------------------------------
DROP POLICY IF EXISTS "lease_contacts_allow_all" ON public.lease_contacts;
DROP POLICY IF EXISTS "lease_contacts_authenticated_update" ON public.lease_contacts;
DROP POLICY IF EXISTS "lease_contacts_authenticated_insert" ON public.lease_contacts;

CREATE POLICY "lease_contacts_org_member_read" ON public.lease_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.lease_contacts.org_id
    )
  );

CREATE POLICY "lease_contacts_org_admin_update" ON public.lease_contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.lease_contacts.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.lease_contacts.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "lease_contacts_org_admin_insert" ON public.lease_contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.lease_contacts.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "lease_contacts_visible_to_tenant" ON public.lease_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = public.lease_contacts.tenant_id
        AND t.user_id = (select auth.uid())
    )
  );

------------------------------
-- OWNERS
------------------------------
DROP POLICY IF EXISTS "owners_allow_all" ON public.owners;
DROP POLICY IF EXISTS "owners_authenticated_update" ON public.owners;
DROP POLICY IF EXISTS "owners_authenticated_insert" ON public.owners;

CREATE POLICY "owners_org_member_read" ON public.owners
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.owners.org_id
    )
  );

CREATE POLICY "owners_org_admin_update" ON public.owners
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.owners.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.owners.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "owners_org_admin_insert" ON public.owners
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.owners.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "owners_self" ON public.owners
  FOR SELECT USING (
    (public.owners.user_id = (select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.owners.org_id
    )
  );

------------------------------
-- OWNERSHIPS
------------------------------
DROP POLICY IF EXISTS "ownerships_allow_all" ON public.ownerships;
DROP POLICY IF EXISTS "ownerships_authenticated_update" ON public.ownerships;
DROP POLICY IF EXISTS "ownerships_authenticated_insert" ON public.ownerships;

CREATE POLICY "ownerships_org_member_read" ON public.ownerships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.ownerships.org_id
    )
  );

CREATE POLICY "ownerships_org_admin_update" ON public.ownerships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.ownerships.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.ownerships.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

CREATE POLICY "ownerships_org_admin_insert" ON public.ownerships
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.org_id = public.ownerships.org_id
        AND m.role IN ('org_admin','org_manager','platform_admin')
    )
  );

commit;
