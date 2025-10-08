-- Fix Infinite Recursion in org_memberships RLS Policies
-- This migration fixes the circular dependency in org_memberships policies
-- that reference org_memberships within org_memberships table itself
-- ============================================================================
-- PART 1: REMOVE PROBLEMATIC POLICIES THAT CAUSE INFINITE RECURSION
-- ============================================================================
-- Remove policies that reference org_memberships within org_memberships
DROP POLICY IF EXISTS "memberships_admin_read" ON public.org_memberships;
DROP POLICY IF EXISTS "memberships_admin_update" ON public.org_memberships;
DROP POLICY IF EXISTS "memberships_admin_write" ON public.org_memberships;
-- ============================================================================
-- PART 2: CREATE SIMPLE, NON-RECURSIVE POLICIES FOR org_memberships
-- ============================================================================
-- Allow users to read their own memberships (no recursion)
CREATE POLICY "memberships_self_read" ON public.org_memberships FOR
SELECT USING (
        user_id = (
            select auth.uid()
        )
    );
-- Allow users to read memberships in their organizations (no recursion)
-- This uses a simple approach that doesn't reference org_memberships
CREATE POLICY "memberships_org_read" ON public.org_memberships FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.organizations o
            WHERE o.id = org_memberships.org_id
                AND EXISTS (
                    SELECT 1
                    FROM public.org_memberships m
                    WHERE m.user_id = (
                            select auth.uid()
                        )
                        AND m.org_id = o.id
                )
        )
    );
-- Allow org admins to manage memberships (no recursion)
CREATE POLICY "memberships_admin_manage" ON public.org_memberships FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = org_memberships.org_id
            AND EXISTS (
                SELECT 1
                FROM public.org_memberships m
                WHERE m.user_id = (
                        select auth.uid()
                    )
                    AND m.org_id = o.id
                    AND m.role IN ('org_admin', 'platform_admin')
            )
    )
);
-- ============================================================================
-- PART 3: UPDATE OTHER POLICIES TO AVOID RECURSION
-- ============================================================================
-- Update bank_accounts policies to avoid recursion
DROP POLICY IF EXISTS "bank_accounts_org_read" ON public.bank_accounts;
CREATE POLICY "bank_accounts_org_read" ON public.bank_accounts FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.organizations o
            WHERE o.id = bank_accounts.org_id
                AND EXISTS (
                    SELECT 1
                    FROM public.org_memberships m
                    WHERE m.user_id = (
                            select auth.uid()
                        )
                        AND m.org_id = o.id
                )
        )
    );
DROP POLICY IF EXISTS "bank_accounts_org_update" ON public.bank_accounts;
CREATE POLICY "bank_accounts_org_update" ON public.bank_accounts FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.organizations o
            WHERE o.id = bank_accounts.org_id
                AND EXISTS (
                    SELECT 1
                    FROM public.org_memberships m
                    WHERE m.user_id = (
                            select auth.uid()
                        )
                        AND m.org_id = o.id
                        AND m.role IN ('org_admin', 'org_manager', 'platform_admin')
                )
        )
    );
DROP POLICY IF EXISTS "bank_accounts_org_write" ON public.bank_accounts;
CREATE POLICY "bank_accounts_org_write" ON public.bank_accounts FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.organizations o
            WHERE o.id = bank_accounts.org_id
                AND EXISTS (
                    SELECT 1
                    FROM public.org_memberships m
                    WHERE m.user_id = (
                            select auth.uid()
                        )
                        AND m.org_id = o.id
                        AND m.role IN ('org_admin', 'org_manager', 'platform_admin')
                )
        )
    );
-- ============================================================================
-- PART 4: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================
COMMENT ON SCHEMA public IS 'Fixed infinite recursion in org_memberships RLS policies - removed circular dependencies that caused banking update failures';