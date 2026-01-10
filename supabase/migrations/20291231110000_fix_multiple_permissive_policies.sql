-- Fix remaining multiple permissive policies warnings
-- Split FOR ALL policies into separate INSERT, UPDATE, DELETE policies
-- to avoid overlap with SELECT policies

BEGIN;

-- Fix membership_roles: Split admin_write FOR ALL into separate policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'membership_roles'
    AND policyname = 'membership_roles_admin_write'
  ) THEN
    -- Drop the FOR ALL policy
    DROP POLICY IF EXISTS membership_roles_admin_write ON public.membership_roles;
    
    -- Create separate policies for each operation to avoid SELECT overlap
    CREATE POLICY membership_roles_admin_insert ON public.membership_roles
      FOR INSERT TO authenticated, dashboard_user
      WITH CHECK (
        public.is_org_admin((select auth.uid()), org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
    
    CREATE POLICY membership_roles_admin_update ON public.membership_roles
      FOR UPDATE TO authenticated, dashboard_user
      USING (
        public.is_org_admin((select auth.uid()), org_id)
        OR public.is_platform_admin((select auth.uid()))
      )
      WITH CHECK (
        public.is_org_admin((select auth.uid()), org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
    
    CREATE POLICY membership_roles_admin_delete ON public.membership_roles
      FOR DELETE TO authenticated, dashboard_user
      USING (
        public.is_org_admin((select auth.uid()), org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
  END IF;
END $$;

-- Fix org_memberships: Split admin_manage FOR ALL into separate policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'org_memberships'
    AND policyname = 'memberships_admin_manage'
  ) THEN
    -- Drop the FOR ALL policy
    DROP POLICY IF EXISTS memberships_admin_manage ON public.org_memberships;
    
    -- Create separate policies for each operation to avoid SELECT overlap
    CREATE POLICY memberships_admin_insert ON public.org_memberships
      FOR INSERT TO authenticated, dashboard_user
      WITH CHECK (
        public.is_org_admin((select auth.uid()), org_memberships.org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
    
    CREATE POLICY memberships_admin_update ON public.org_memberships
      FOR UPDATE TO authenticated, dashboard_user
      USING (
        public.is_org_admin((select auth.uid()), org_memberships.org_id)
        OR public.is_platform_admin((select auth.uid()))
      )
      WITH CHECK (
        public.is_org_admin((select auth.uid()), org_memberships.org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
    
    CREATE POLICY memberships_admin_delete ON public.org_memberships
      FOR DELETE TO authenticated, dashboard_user
      USING (
        public.is_org_admin((select auth.uid()), org_memberships.org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
  END IF;
END $$;

COMMIT;



