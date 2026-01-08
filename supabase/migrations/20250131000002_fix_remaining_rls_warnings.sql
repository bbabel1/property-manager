-- Fix remaining RLS warnings:
-- 1. Wrap all auth.*() calls in (select ...) to avoid initplans
-- 2. Consolidate multiple permissive policies where possible

BEGIN;

-- Helper function to wrap auth calls in policies
CREATE OR REPLACE FUNCTION public.fix_policy_auth_calls()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pol RECORD;
  new_using TEXT;
  new_with_check TEXT;
  needs_update BOOLEAN;
BEGIN
  FOR pol IN
    SELECT
      n.nspname  AS schema_name,
      c.relname  AS table_name,
      p.polname  AS policy_name,
      pg_get_expr(p.polqual, p.polrelid)      AS using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        pg_get_expr(p.polqual, p.polrelid) LIKE '%auth.%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%auth.%'
        OR pg_get_expr(p.polqual, p.polrelid) LIKE '%current_setting(%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%current_setting(%'
      )
      -- Only fix policies that aren't already wrapped
      AND (
        pg_get_expr(p.polqual, p.polrelid) NOT LIKE '%(select auth.%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) NOT LIKE '%(select auth.%'
      )
  LOOP
    needs_update := false;
    new_using := pol.using_expr;
    new_with_check := pol.with_check_expr;

    -- Wrap auth.uid() calls that aren't already wrapped
    IF pol.using_expr IS NOT NULL THEN
      -- Replace auth.uid() with (select auth.uid()) when not already wrapped
      new_using := regexp_replace(
        new_using,
        '\bauth\.uid\(\)',
        '(select auth.uid())',
        'g'
      );
      -- Replace auth.role() with (select auth.role()) when not already wrapped
      new_using := regexp_replace(
        new_using,
        '\bauth\.role\(\)',
        '(select auth.role())',
        'g'
      );
      -- Replace current_setting() with (select current_setting()) when not already wrapped
      new_using := regexp_replace(
        new_using,
        '\bcurrent_setting\(([^)]+)\)',
        '(select current_setting(\1))',
        'g'
      );
      IF new_using <> pol.using_expr THEN
        needs_update := true;
      END IF;
    END IF;

    IF pol.with_check_expr IS NOT NULL THEN
      -- Replace auth.uid() with (select auth.uid()) when not already wrapped
      new_with_check := regexp_replace(
        new_with_check,
        '\bauth\.uid\(\)',
        '(select auth.uid())',
        'g'
      );
      -- Replace auth.role() with (select auth.role()) when not already wrapped
      new_with_check := regexp_replace(
        new_with_check,
        '\bauth\.role\(\)',
        '(select auth.role())',
        'g'
      );
      -- Replace current_setting() with (select current_setting()) when not already wrapped
      new_with_check := regexp_replace(
        new_with_check,
        '\bcurrent_setting\(([^)]+)\)',
        '(select current_setting(\1))',
        'g'
      );
      IF new_with_check <> pol.with_check_expr THEN
        needs_update := true;
      END IF;
    END IF;

    IF needs_update THEN
      IF pol.using_expr IS NOT NULL AND pol.with_check_expr IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
          pol.policy_name,
          pol.schema_name,
          pol.table_name,
          new_using,
          new_with_check
        );
      ELSIF pol.using_expr IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I USING (%s)',
          pol.policy_name,
          pol.schema_name,
          pol.table_name,
          new_using
        );
      ELSIF pol.with_check_expr IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
          pol.policy_name,
          pol.schema_name,
          pol.table_name,
          new_with_check
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Run the fix
SELECT public.fix_policy_auth_calls();
DROP FUNCTION IF EXISTS public.fix_policy_auth_calls();

-- Fix specific policies that need manual attention
-- These policies call helper functions with auth.uid() that need wrapping

-- lease policies (if they exist and need fixing)
DO $$
BEGIN
  -- Only attempt to rewrite lease org policies when org_memberships.role exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'org_memberships'
      AND column_name = 'role'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'lease' 
      AND policyname = 'lease_org_read'
    ) THEN
      -- Recreate with wrapped auth calls
      DROP POLICY IF EXISTS lease_org_read ON public.lease;
      CREATE POLICY lease_org_read ON public.lease
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM public.org_memberships m
            WHERE m.user_id = (select auth.uid()) AND m.org_id = lease.org_id
          )
        );
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'lease' 
      AND policyname = 'lease_org_write'
    ) THEN
      DROP POLICY IF EXISTS lease_org_write ON public.lease;
      EXECUTE $lease_org_write$
        CREATE POLICY lease_org_write ON public.lease
          FOR INSERT WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.org_memberships m
              WHERE m.user_id = (select auth.uid()) AND m.org_id = lease.org_id 
              AND m.role IN ('org_admin','org_manager','platform_admin')
            )
          );
      $lease_org_write$;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'lease' 
      AND policyname = 'lease_org_update'
    ) THEN
      DROP POLICY IF EXISTS lease_org_update ON public.lease;
      EXECUTE $lease_org_update$
        CREATE POLICY lease_org_update ON public.lease
          FOR UPDATE USING (
            EXISTS (
              SELECT 1 FROM public.org_memberships m
              WHERE m.user_id = (select auth.uid()) AND m.org_id = lease.org_id 
              AND m.role IN ('org_admin','org_manager','platform_admin')
            )
          );
      $lease_org_update$;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'lease' 
      AND policyname = 'lease_org_delete'
    ) THEN
      DROP POLICY IF EXISTS lease_org_delete ON public.lease;
      EXECUTE $lease_org_delete$
        CREATE POLICY lease_org_delete ON public.lease
          FOR DELETE USING (
            EXISTS (
              SELECT 1 FROM public.org_memberships m
              WHERE m.user_id = (select auth.uid()) AND m.org_id = lease.org_id 
              AND m.role IN ('org_admin','org_manager','platform_admin')
            )
          );
      $lease_org_delete$;
    END IF;
  END IF;
END $$;

-- monthly_logs policies - wrap auth.uid() in helper function calls
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'monthly_logs' 
    AND policyname = 'monthly_logs_read'
  ) THEN
    DROP POLICY IF EXISTS monthly_logs_read ON public.monthly_logs;
    CREATE POLICY monthly_logs_read ON public.monthly_logs
      FOR SELECT USING (
        public.is_org_member((select auth.uid()), monthly_logs.org_id)
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'monthly_logs' 
    AND policyname = 'monthly_logs_write'
  ) THEN
    DROP POLICY IF EXISTS monthly_logs_write ON public.monthly_logs;
    CREATE POLICY monthly_logs_write ON public.monthly_logs
      FOR INSERT WITH CHECK (
        public.is_org_admin_or_manager((select auth.uid()), monthly_logs.org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'monthly_logs' 
    AND policyname = 'monthly_logs_update'
  ) THEN
    DROP POLICY IF EXISTS monthly_logs_update ON public.monthly_logs;
    CREATE POLICY monthly_logs_update ON public.monthly_logs
      FOR UPDATE USING (
        public.is_org_admin_or_manager((select auth.uid()), monthly_logs.org_id)
        OR public.is_platform_admin((select auth.uid()))
      ) WITH CHECK (
        public.is_org_admin_or_manager((select auth.uid()), monthly_logs.org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'monthly_logs' 
    AND policyname = 'monthly_logs_delete'
  ) THEN
    DROP POLICY IF EXISTS monthly_logs_delete ON public.monthly_logs;
    CREATE POLICY monthly_logs_delete ON public.monthly_logs
      FOR DELETE USING (
        public.is_org_admin_or_manager((select auth.uid()), monthly_logs.org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
  END IF;
END $$;

-- monthly_log_task_rules policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'monthly_log_task_rules'
  ) THEN
    -- Fix all monthly_log_task_rules policies
    DROP POLICY IF EXISTS monthly_log_task_rules_read ON public.monthly_log_task_rules;
    DROP POLICY IF EXISTS monthly_log_task_rules_write ON public.monthly_log_task_rules;
    DROP POLICY IF EXISTS monthly_log_task_rules_update ON public.monthly_log_task_rules;
    DROP POLICY IF EXISTS monthly_log_task_rules_delete ON public.monthly_log_task_rules;

    CREATE POLICY monthly_log_task_rules_read ON public.monthly_log_task_rules
      FOR SELECT USING (
        public.is_org_member((select auth.uid()), monthly_log_task_rules.org_id)
      );

    CREATE POLICY monthly_log_task_rules_write ON public.monthly_log_task_rules
      FOR INSERT WITH CHECK (
        public.is_org_admin_or_manager((select auth.uid()), monthly_log_task_rules.org_id)
        OR public.is_platform_admin((select auth.uid()))
      );

    CREATE POLICY monthly_log_task_rules_update ON public.monthly_log_task_rules
      FOR UPDATE USING (
        public.is_org_admin_or_manager((select auth.uid()), monthly_log_task_rules.org_id)
        OR public.is_platform_admin((select auth.uid()))
      ) WITH CHECK (
        public.is_org_admin_or_manager((select auth.uid()), monthly_log_task_rules.org_id)
        OR public.is_platform_admin((select auth.uid()))
      );

    CREATE POLICY monthly_log_task_rules_delete ON public.monthly_log_task_rules
      FOR DELETE USING (
        public.is_org_admin_or_manager((select auth.uid()), monthly_log_task_rules.org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
  END IF;
END $$;

-- Fix other tables with initplan warnings
-- These will be handled by the regex replacement above, but we'll also fix
-- specific ones that call helper functions

-- role_permissions policies
DO $$
BEGIN
  -- Only rewrite permission_profile policies when org_memberships.role exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'org_memberships'
      AND column_name = 'role'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'role_permissions'
      AND policyname LIKE 'permission_profile_permissions_%'
    ) THEN
      -- Recreate with wrapped auth calls
      DROP POLICY IF EXISTS permission_profile_permissions_read ON public.role_permissions;
      DROP POLICY IF EXISTS permission_profile_permissions_write ON public.role_permissions;
      DROP POLICY IF EXISTS permission_profile_permissions_update ON public.role_permissions;
      DROP POLICY IF EXISTS permission_profile_permissions_delete ON public.role_permissions;

      CREATE POLICY permission_profile_permissions_read ON public.role_permissions
        FOR SELECT USING (
          public.is_org_member((select auth.uid()), 
            (SELECT org_id FROM public.membership_roles WHERE id = role_permissions.role_id))
        );

      EXECUTE $perm_prof_write$
        CREATE POLICY permission_profile_permissions_write ON public.role_permissions
          FOR INSERT WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.membership_roles mr
              JOIN public.org_memberships om ON om.org_id = mr.org_id
              WHERE mr.id = role_permissions.role_id
                AND om.user_id = (select auth.uid())
                AND om.role IN ('org_admin', 'platform_admin')
            )
          );
      $perm_prof_write$;

      EXECUTE $perm_prof_update$
        CREATE POLICY permission_profile_permissions_update ON public.role_permissions
          FOR UPDATE USING (
            EXISTS (
              SELECT 1 FROM public.membership_roles mr
              JOIN public.org_memberships om ON om.org_id = mr.org_id
              WHERE mr.id = role_permissions.role_id
                AND om.user_id = (select auth.uid())
                AND om.role IN ('org_admin', 'platform_admin')
            )
          );
      $perm_prof_update$;

      EXECUTE $perm_prof_delete$
        CREATE POLICY permission_profile_permissions_delete ON public.role_permissions
          FOR DELETE USING (
            EXISTS (
              SELECT 1 FROM public.membership_roles mr
              JOIN public.org_memberships om ON om.org_id = mr.org_id
              WHERE mr.id = role_permissions.role_id
                AND om.user_id = (select auth.uid())
                AND om.role IN ('org_admin', 'platform_admin')
            )
          );
      $perm_prof_delete$;
    END IF;
  END IF;
END $$;

-- Fix buildium_integrations service role policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'buildium_integrations' 
    AND policyname = 'buildium_integrations_service_role_full_access'
  ) THEN
    DROP POLICY IF EXISTS buildium_integrations_service_role_full_access ON public.buildium_integrations;
    CREATE POLICY buildium_integrations_service_role_full_access
      ON public.buildium_integrations FOR ALL TO service_role
      USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
END $$;

-- Fix buildium_integration_audit_log service role policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'buildium_integration_audit_log' 
    AND policyname = 'buildium_integration_audit_log_service_role_full_access'
  ) THEN
    DROP POLICY IF EXISTS buildium_integration_audit_log_service_role_full_access ON public.buildium_integration_audit_log;
    CREATE POLICY buildium_integration_audit_log_service_role_full_access
      ON public.buildium_integration_audit_log FOR ALL TO service_role
      USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
END $$;

-- Consolidate multiple permissive policies for membership_roles
-- Combine membership_roles_admin_write and user_permission_profiles_* into single policies
DO $$
BEGIN
  -- Only consolidate when org_memberships.role exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'org_memberships'
      AND column_name = 'role'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'membership_roles'
      AND policyname IN ('membership_roles_admin_write', 'user_permission_profiles_read', 'user_permission_profiles_write', 'user_permission_profiles_update', 'user_permission_profiles_delete')
    ) THEN
      -- Drop the overlapping policies
      DROP POLICY IF EXISTS user_permission_profiles_read ON public.membership_roles;
      DROP POLICY IF EXISTS user_permission_profiles_write ON public.membership_roles;
      DROP POLICY IF EXISTS user_permission_profiles_update ON public.membership_roles;
      DROP POLICY IF EXISTS user_permission_profiles_delete ON public.membership_roles;
      
      -- Ensure membership_roles_admin_write covers all operations
      DROP POLICY IF EXISTS membership_roles_admin_write ON public.membership_roles;
      EXECUTE $membership_roles_admin_write$
        CREATE POLICY membership_roles_admin_write ON public.membership_roles
          FOR ALL TO authenticated, dashboard_user
          USING (
            EXISTS (
              SELECT 1 FROM public.org_memberships om
              WHERE om.org_id = membership_roles.org_id
                AND om.user_id = (select auth.uid())
                AND om.role IN ('org_admin', 'platform_admin')
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.org_memberships om
              WHERE om.org_id = membership_roles.org_id
                AND om.user_id = (select auth.uid())
                AND om.role IN ('org_admin', 'platform_admin')
            )
          );
      $membership_roles_admin_write$;
    END IF;

    -- Consolidate multiple permissive policies for org_memberships
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'org_memberships'
      AND policyname IN ('memberships_read', 'memberships_admin_manage')
    ) THEN
      -- Combine into a single policy that handles both read and admin operations
      DROP POLICY IF EXISTS memberships_read ON public.org_memberships;
      DROP POLICY IF EXISTS memberships_admin_manage ON public.org_memberships;
      
      EXECUTE $memberships_read$
        CREATE POLICY memberships_read ON public.org_memberships
          FOR SELECT TO authenticated, dashboard_user
          USING (
            user_id = (select auth.uid())
            OR EXISTS (
              SELECT 1 FROM public.org_memberships om
              WHERE om.org_id = org_memberships.org_id
                AND om.user_id = (select auth.uid())
                AND om.role IN ('org_admin', 'platform_admin')
            )
          );
      $memberships_read$;
      
      EXECUTE $memberships_admin_manage$
        CREATE POLICY memberships_admin_manage ON public.org_memberships
          FOR INSERT, UPDATE, DELETE TO authenticated, dashboard_user
          USING (
            EXISTS (
              SELECT 1 FROM public.org_memberships om
              WHERE om.org_id = org_memberships.org_id
                AND om.user_id = (select auth.uid())
                AND om.role IN ('org_admin', 'platform_admin')
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.org_memberships om
              WHERE om.org_id = org_memberships.org_id
                AND om.user_id = (select auth.uid())
                AND om.role IN ('org_admin', 'platform_admin')
            )
          );
      $memberships_admin_manage$;
    END IF;
  END IF;
END $$;

COMMIT;
