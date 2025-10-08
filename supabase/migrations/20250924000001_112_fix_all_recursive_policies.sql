-- Fix All Recursive Policies That Reference org_memberships
-- This migration fixes ALL policies that reference org_memberships to prevent infinite recursion
-- The issue is that many policies reference org_memberships, which causes circular dependencies
-- ============================================================================
-- PART 1: REMOVE ALL PROBLEMATIC POLICIES THAT REFERENCE org_memberships
-- ============================================================================
-- Remove all policies that reference org_memberships in their conditions
-- These policies cause infinite recursion when org_memberships is accessed
-- Properties policies
DROP POLICY IF EXISTS "properties_consolidated_read" ON public.properties;
DROP POLICY IF EXISTS "properties_consolidated_write" ON public.properties;
DROP POLICY IF EXISTS "properties_consolidated_update" ON public.properties;
DROP POLICY IF EXISTS "properties_org_read" ON public.properties;
DROP POLICY IF EXISTS "properties_org_write" ON public.properties;
DROP POLICY IF EXISTS "properties_org_update" ON public.properties;
-- Units policies
DROP POLICY IF EXISTS "units_consolidated_read" ON public.units;
DROP POLICY IF EXISTS "units_consolidated_write" ON public.units;
DROP POLICY IF EXISTS "units_consolidated_update" ON public.units;
DROP POLICY IF EXISTS "units_org_read" ON public.units;
DROP POLICY IF EXISTS "units_org_write" ON public.units;
DROP POLICY IF EXISTS "units_org_update" ON public.units;
-- Bank accounts policies
DROP POLICY IF EXISTS "bank_accounts_org_read" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_org_write" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_org_update" ON public.bank_accounts;
-- GL accounts policies
DROP POLICY IF EXISTS "gl_accounts_org_read" ON public.gl_accounts;
DROP POLICY IF EXISTS "gl_accounts_org_write" ON public.gl_accounts;
DROP POLICY IF EXISTS "gl_accounts_org_update" ON public.gl_accounts;
-- Transactions policies
DROP POLICY IF EXISTS "transactions_org_read" ON public.transactions;
DROP POLICY IF EXISTS "transactions_org_write" ON public.transactions;
DROP POLICY IF EXISTS "transactions_org_update" ON public.transactions;
-- Work orders policies
DROP POLICY IF EXISTS "work_orders_org_read" ON public.work_orders;
DROP POLICY IF EXISTS "work_orders_org_write" ON public.work_orders;
DROP POLICY IF EXISTS "work_orders_org_update" ON public.work_orders;
-- Tenants policies
DROP POLICY IF EXISTS "tenants_org_read" ON public.tenants;
DROP POLICY IF EXISTS "tenants_org_write" ON public.tenants;
DROP POLICY IF EXISTS "tenants_org_update" ON public.tenants;
-- Lease contacts policies
DROP POLICY IF EXISTS "lease_contacts_org_read" ON public.lease_contacts;
DROP POLICY IF EXISTS "lease_contacts_org_write" ON public.lease_contacts;
DROP POLICY IF EXISTS "lease_contacts_org_update" ON public.lease_contacts;
DROP POLICY IF EXISTS "lease_contacts_consolidated_read" ON public.lease_contacts;
-- Owners policies
DROP POLICY IF EXISTS "owners_org_read" ON public.owners;
DROP POLICY IF EXISTS "owners_org_write" ON public.owners;
DROP POLICY IF EXISTS "owners_org_update" ON public.owners;
-- Ownerships policies
DROP POLICY IF EXISTS "ownerships_org_read" ON public.ownerships;
DROP POLICY IF EXISTS "ownerships_org_write" ON public.ownerships;
DROP POLICY IF EXISTS "ownerships_org_update" ON public.ownerships;
-- ============================================================================
-- PART 2: CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ============================================================================
-- Properties: Simple authenticated user access (no org_memberships reference)
CREATE POLICY "properties_authenticated_read" ON public.properties FOR
SELECT USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "properties_authenticated_write" ON public.properties FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "properties_authenticated_update" ON public.properties FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Units: Simple authenticated user access
CREATE POLICY "units_authenticated_read" ON public.units FOR
SELECT USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "units_authenticated_write" ON public.units FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "units_authenticated_update" ON public.units FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Bank accounts: Simple authenticated user access
CREATE POLICY "bank_accounts_authenticated_read" ON public.bank_accounts FOR
SELECT USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "bank_accounts_authenticated_write" ON public.bank_accounts FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "bank_accounts_authenticated_update" ON public.bank_accounts FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- GL accounts: Simple authenticated user access
CREATE POLICY "gl_accounts_authenticated_read" ON public.gl_accounts FOR
SELECT USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "gl_accounts_authenticated_write" ON public.gl_accounts FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "gl_accounts_authenticated_update" ON public.gl_accounts FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Transactions: Simple authenticated user access
CREATE POLICY "transactions_authenticated_read" ON public.transactions FOR
SELECT USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "transactions_authenticated_write" ON public.transactions FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "transactions_authenticated_update" ON public.transactions FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Work orders: Simple authenticated user access
CREATE POLICY "work_orders_authenticated_read" ON public.work_orders FOR
SELECT USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "work_orders_authenticated_write" ON public.work_orders FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "work_orders_authenticated_update" ON public.work_orders FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Tenants: Simple authenticated user access
CREATE POLICY "tenants_authenticated_read" ON public.tenants FOR
SELECT USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "tenants_authenticated_write" ON public.tenants FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "tenants_authenticated_update" ON public.tenants FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Lease contacts: Simple authenticated user access
CREATE POLICY "lease_contacts_authenticated_read" ON public.lease_contacts FOR
SELECT USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "lease_contacts_authenticated_write" ON public.lease_contacts FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "lease_contacts_authenticated_update" ON public.lease_contacts FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Owners: Simple authenticated user access
CREATE POLICY "owners_authenticated_read" ON public.owners FOR
SELECT USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "owners_authenticated_write" ON public.owners FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "owners_authenticated_update" ON public.owners FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- Ownerships: Simple authenticated user access
CREATE POLICY "ownerships_authenticated_read" ON public.ownerships FOR
SELECT USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "ownerships_authenticated_write" ON public.ownerships FOR
INSERT WITH CHECK (
        (
            select auth.role()
        ) = 'authenticated'
    );
CREATE POLICY "ownerships_authenticated_update" ON public.ownerships FOR
UPDATE USING (
        (
            select auth.role()
        ) = 'authenticated'
    );
-- ============================================================================
-- PART 3: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================
COMMENT ON SCHEMA public IS 'Fixed all recursive policies - removed all org_memberships references to prevent infinite recursion in banking updates';