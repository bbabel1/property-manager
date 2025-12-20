-- Fix org membership helper functions to allow SET LOCAL usage.
-- Previous definitions were STABLE, which blocks SET statements and caused
-- "SET is not allowed in a non-volatile function" errors when RLS policies
-- invoked these helpers. Recreate them as VOLATILE while retaining security
-- definer behavior and execution grants.

CREATE OR REPLACE FUNCTION public.is_org_member(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = p_user_id
      AND org_id = p_org_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION public.is_org_admin_or_manager(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public AS $$
BEGIN
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

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin_or_manager(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.is_org_member IS 'Checks if a user is a member of an org. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';
COMMENT ON FUNCTION public.is_org_admin IS 'Checks if a user has admin role in an org. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';
COMMENT ON FUNCTION public.is_org_admin_or_manager IS 'Checks if a user has admin or manager role in an org. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';
