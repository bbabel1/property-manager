-- Fix RLS Policies to Allow Updates
-- The current policies only allow SELECT but not UPDATE/INSERT operations
-- This migration adds proper UPDATE and INSERT policies
-- ============================================================================
-- PART 1: ADD UPDATE POLICIES FOR ALL TABLES
-- ============================================================================
-- Properties: Add UPDATE policy
DROP POLICY IF EXISTS "properties_authenticated_update" ON public.properties;
CREATE POLICY "properties_authenticated_update" ON public.properties FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Units: Add UPDATE policy  
DROP POLICY IF EXISTS "units_authenticated_update" ON public.units;
CREATE POLICY "units_authenticated_update" ON public.units FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Bank accounts: Add UPDATE policy
DROP POLICY IF EXISTS "bank_accounts_authenticated_update" ON public.bank_accounts;
CREATE POLICY "bank_accounts_authenticated_update" ON public.bank_accounts FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- GL accounts: Add UPDATE policy
DROP POLICY IF EXISTS "gl_accounts_authenticated_update" ON public.gl_accounts;
CREATE POLICY "gl_accounts_authenticated_update" ON public.gl_accounts FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Transactions: Add UPDATE policy
DROP POLICY IF EXISTS "transactions_authenticated_update" ON public.transactions;
CREATE POLICY "transactions_authenticated_update" ON public.transactions FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Work orders: Add UPDATE policy
DROP POLICY IF EXISTS "work_orders_authenticated_update" ON public.work_orders;
CREATE POLICY "work_orders_authenticated_update" ON public.work_orders FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Tenants: Add UPDATE policy
DROP POLICY IF EXISTS "tenants_authenticated_update" ON public.tenants;
CREATE POLICY "tenants_authenticated_update" ON public.tenants FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Lease contacts: Add UPDATE policy
DROP POLICY IF EXISTS "lease_contacts_authenticated_update" ON public.lease_contacts;
CREATE POLICY "lease_contacts_authenticated_update" ON public.lease_contacts FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Owners: Add UPDATE policy
DROP POLICY IF EXISTS "owners_authenticated_update" ON public.owners;
CREATE POLICY "owners_authenticated_update" ON public.owners FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Ownerships: Add UPDATE policy
DROP POLICY IF EXISTS "ownerships_authenticated_update" ON public.ownerships;
CREATE POLICY "ownerships_authenticated_update" ON public.ownerships FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- ============================================================================
-- PART 2: ADD INSERT POLICIES FOR ALL TABLES
-- ============================================================================
-- Properties: Add INSERT policy
DROP POLICY IF EXISTS "properties_authenticated_insert" ON public.properties;
CREATE POLICY "properties_authenticated_insert" ON public.properties FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Units: Add INSERT policy
DROP POLICY IF EXISTS "units_authenticated_insert" ON public.units;
CREATE POLICY "units_authenticated_insert" ON public.units FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Bank accounts: Add INSERT policy
DROP POLICY IF EXISTS "bank_accounts_authenticated_insert" ON public.bank_accounts;
CREATE POLICY "bank_accounts_authenticated_insert" ON public.bank_accounts FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- GL accounts: Add INSERT policy
DROP POLICY IF EXISTS "gl_accounts_authenticated_insert" ON public.gl_accounts;
CREATE POLICY "gl_accounts_authenticated_insert" ON public.gl_accounts FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Transactions: Add INSERT policy
DROP POLICY IF EXISTS "transactions_authenticated_insert" ON public.transactions;
CREATE POLICY "transactions_authenticated_insert" ON public.transactions FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Work orders: Add INSERT policy
DROP POLICY IF EXISTS "work_orders_authenticated_insert" ON public.work_orders;
CREATE POLICY "work_orders_authenticated_insert" ON public.work_orders FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Tenants: Add INSERT policy
DROP POLICY IF EXISTS "tenants_authenticated_insert" ON public.tenants;
CREATE POLICY "tenants_authenticated_insert" ON public.tenants FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Lease contacts: Add INSERT policy
DROP POLICY IF EXISTS "lease_contacts_authenticated_insert" ON public.lease_contacts;
CREATE POLICY "lease_contacts_authenticated_insert" ON public.lease_contacts FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Owners: Add INSERT policy
DROP POLICY IF EXISTS "owners_authenticated_insert" ON public.owners;
CREATE POLICY "owners_authenticated_insert" ON public.owners FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Ownerships: Add INSERT policy
DROP POLICY IF EXISTS "ownerships_authenticated_insert" ON public.ownerships;
CREATE POLICY "ownerships_authenticated_insert" ON public.ownerships FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- ============================================================================
-- PART 3: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================
COMMENT ON SCHEMA public IS 'Fixed RLS policies to allow authenticated users to perform UPDATE and INSERT operations - banking updates should now work';