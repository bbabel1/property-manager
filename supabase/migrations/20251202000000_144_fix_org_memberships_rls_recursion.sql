-- Fix Infinite Recursion in org_memberships RLS Policies
-- This migration creates a SECURITY DEFINER function to check membership
-- without triggering RLS recursion, then updates policies to use it.
-- ============================================================================
-- PART 1: CREATE SECURITY DEFINER FUNCTION TO CHECK MEMBERSHIP
-- ============================================================================
-- This function bypasses RLS to check if a user is a member of an org
-- It's safe because it only reads data and doesn't expose sensitive info
CREATE OR REPLACE FUNCTION public.is_org_member(p_user_id uuid, p_org_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public AS $$ BEGIN -- Temporarily disable RLS to avoid infinite recursion
SET LOCAL row_security = off;
RETURN EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = p_user_id
        AND org_id = p_org_id
);
END;
$$;
-- Function to check if user has admin role in org
CREATE OR REPLACE FUNCTION public.is_org_admin(p_user_id uuid, p_org_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public AS $$ BEGIN -- Temporarily disable RLS to avoid infinite recursion
SET LOCAL row_security = off;
RETURN EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = p_user_id
        AND org_id = p_org_id
        AND role IN ('org_admin', 'platform_admin')
);
END;
$$;
-- Function to check if user has admin or manager role in org
CREATE OR REPLACE FUNCTION public.is_org_admin_or_manager(p_user_id uuid, p_org_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public AS $$ BEGIN -- Temporarily disable RLS to avoid infinite recursion
SET LOCAL row_security = off;
RETURN EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = p_user_id
        AND org_id = p_org_id
        AND role IN ('org_admin', 'org_manager', 'platform_admin')
);
END;
$$;
-- ============================================================================
-- PART 2: REMOVE RECURSIVE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "memberships_org_read" ON public.org_memberships;
DROP POLICY IF EXISTS "memberships_admin_manage" ON public.org_memberships;
DROP POLICY IF EXISTS "memberships_admin_read" ON public.org_memberships;
DROP POLICY IF EXISTS "memberships_admin_update" ON public.org_memberships;
DROP POLICY IF EXISTS "memberships_admin_write" ON public.org_memberships;
DROP POLICY IF EXISTS "memberships_consolidated_read" ON public.org_memberships;
-- ============================================================================
-- PART 3: CREATE NON-RECURSIVE POLICIES FOR org_memberships
-- ============================================================================
-- Allow users to read their own memberships (no recursion - direct user_id check)
-- This policy is already correct and doesn't need changes
-- Just ensure it exists
DROP POLICY IF EXISTS "memberships_self_read" ON public.org_memberships;
CREATE POLICY "memberships_self_read" ON public.org_memberships FOR
SELECT USING (user_id = auth.uid());
-- Allow users to read memberships in organizations where they are members
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "memberships_org_read" ON public.org_memberships FOR
SELECT USING (public.is_org_member(auth.uid(), org_id));
-- Allow org admins to manage memberships (insert, update, delete)
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "memberships_admin_manage" ON public.org_memberships FOR ALL USING (public.is_org_admin(auth.uid(), org_id)) WITH CHECK (public.is_org_admin(auth.uid(), org_id));
-- ============================================================================
-- PART 4: GRANT PERMISSIONS
-- ============================================================================
-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin_or_manager(uuid, uuid) TO authenticated;
-- ============================================================================
-- PART 5: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION public.is_org_member IS 'Checks if a user is a member of an org. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';
COMMENT ON FUNCTION public.is_org_admin IS 'Checks if a user has admin role in an org. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';
COMMENT ON FUNCTION public.is_org_admin_or_manager IS 'Checks if a user has admin or manager role in an org. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';