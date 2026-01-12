-- Fix remaining Supabase linter warnings:
-- 1) Wrap auth/current_setting calls in RLS policies to avoid initplans
-- 2) Scope permissive policies to explicit roles to avoid duplicates per role/action

BEGIN;

-- Helper to wrap auth.*() and current_setting() calls inside policy predicates
CREATE OR REPLACE FUNCTION public.wrap_auth_calls_in_policies()
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
        pg_get_expr(p.polqual, p.polrelid) ILIKE '%auth.%(%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%auth.%(%'
        OR pg_get_expr(p.polqual, p.polrelid) ILIKE '%current_setting(%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%current_setting(%'
      )
  LOOP
    needs_update := false;
    new_using := pol.using_expr;
    new_with_check := pol.with_check_expr;

    IF pol.using_expr IS NOT NULL THEN
      -- Wrap auth.*() calls that aren't already wrapped in (select ...)
      -- Use a simpler pattern: match auth.function() not preceded by (select
      new_using := regexp_replace(
        new_using,
        '([^\(]|^)auth\.([a-zA-Z0-9_]+)\(([^)]*)\)',
        '\1(select auth.\2(\3))',
        'g'
      );
      -- Wrap current_setting() calls that aren't already wrapped
      new_using := regexp_replace(
        new_using,
        '([^\(]|^)current_setting\(([^)]*)\)',
        '\1(select current_setting(\2))',
        'g'
      );
      IF new_using <> pol.using_expr THEN
        needs_update := true;
      END IF;
    END IF;

    IF pol.with_check_expr IS NOT NULL THEN
      -- Wrap auth.*() calls that aren't already wrapped in (select ...)
      new_with_check := regexp_replace(
        new_with_check,
        '([^\(]|^)auth\.([a-zA-Z0-9_]+)\(([^)]*)\)',
        '\1(select auth.\2(\3))',
        'g'
      );
      -- Wrap current_setting() calls that aren't already wrapped
      new_with_check := regexp_replace(
        new_with_check,
        '([^\(]|^)current_setting\(([^)]*)\)',
        '\1(select current_setting(\2))',
        'g'
      );
      IF new_with_check <> pol.with_check_expr THEN
        needs_update := true;
      END IF;
    END IF;

    IF needs_update THEN
      IF pol.using_expr IS NOT NULL AND pol.with_check_expr IS NOT NULL THEN
        EXECUTE
          'ALTER POLICY '
          || quote_ident(pol.policy_name)
          || ' ON '
          || quote_ident(pol.schema_name) || '.' || quote_ident(pol.table_name)
          || ' USING (' || new_using || ') WITH CHECK (' || new_with_check || ')';
      ELSIF pol.using_expr IS NOT NULL THEN
        EXECUTE
          'ALTER POLICY '
          || quote_ident(pol.policy_name)
          || ' ON '
          || quote_ident(pol.schema_name) || '.' || quote_ident(pol.table_name)
          || ' USING (' || new_using || ')';
      ELSIF pol.with_check_expr IS NOT NULL THEN
        EXECUTE
          'ALTER POLICY '
          || quote_ident(pol.policy_name)
          || ' ON '
          || quote_ident(pol.schema_name) || '.' || quote_ident(pol.table_name)
          || ' WITH CHECK (' || new_with_check || ')';
      END IF;
    END IF;
  END LOOP;
END;
$$;

SELECT public.wrap_auth_calls_in_policies();
DROP FUNCTION IF EXISTS public.wrap_auth_calls_in_policies();

-- Helper to set policy roles in a consistent, idempotent way
CREATE OR REPLACE FUNCTION public.set_policy_roles(
  schema_name TEXT,
  table_name  TEXT,
  policy_name TEXT,
  roles       TEXT[]
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  qualified_table TEXT := format('%I.%I', schema_name, table_name);
  role_list TEXT;
BEGIN
  IF to_regclass(qualified_table) IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = policy_name
      AND polrelid = qualified_table::regclass
  ) THEN
    RETURN;
  END IF;

  role_list := array_to_string(
    ARRAY(SELECT quote_ident(r) FROM unnest(roles) r),
    ', '
  );

  IF role_list IS NULL OR role_list = '' THEN
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER POLICY %I ON %s TO %s',
    policy_name,
    qualified_table,
    role_list
  );
END;
$$;

DO $$
BEGIN
  -- building_permits
  PERFORM public.set_policy_roles('public','building_permits','building_permits_org_read',    ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','building_permits','building_permits_org_insert',  ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','building_permits','building_permits_org_update',  ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','building_permits','building_permits_org_delete',  ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','building_permits','building_permits_service_role_full_access', ARRAY['service_role']);

  -- buildings
  PERFORM public.set_policy_roles('public','buildings','Allow authenticated read buildings', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','buildings','Allow service role all on buildings', ARRAY['service_role']);

  -- buildium_integration_audit_log
  PERFORM public.set_policy_roles('public','buildium_integration_audit_log','buildium_integration_audit_log_org_read', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','buildium_integration_audit_log','buildium_integration_audit_log_service_role_full_access', ARRAY['service_role']);

  -- buildium_integrations
  PERFORM public.set_policy_roles('public','buildium_integrations','buildium_integrations_org_read',    ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','buildium_integrations','buildium_integrations_org_insert',  ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','buildium_integrations','buildium_integrations_org_update',  ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','buildium_integrations','buildium_integrations_org_delete',  ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','buildium_integrations','buildium_integrations_service_role_full_access', ARRAY['service_role']);

  -- buildium_sync_runs
  PERFORM public.set_policy_roles('public','buildium_sync_runs','buildium_sync_runs_read_in_org', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','buildium_sync_runs','buildium_sync_runs_service_role_all', ARRAY['service_role']);

  -- buildium_sync_status
  PERFORM public.set_policy_roles('public','buildium_sync_status','buildium_sync_status_read_in_org', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','buildium_sync_status','buildium_sync_status_service_role_all', ARRAY['service_role']);

  -- buildium_webhook_events
  PERFORM public.set_policy_roles('public','buildium_webhook_events','buildium_webhook_events_read_in_org', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','buildium_webhook_events','buildium_webhook_events_service_role_all', ARRAY['service_role']);

  -- gmail_integrations
  PERFORM public.set_policy_roles('public','gmail_integrations','Staff can view own Gmail integration', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','gmail_integrations','Staff can update own Gmail integration', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','gmail_integrations','Staff can delete own Gmail integration', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','gmail_integrations','Deny INSERT for regular users', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','gmail_integrations','Service role full access', ARRAY['service_role']);

  -- google_calendar_integrations
  PERFORM public.set_policy_roles('public','google_calendar_integrations','Staff can view own Calendar integration', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','google_calendar_integrations','Staff can update own Calendar integration', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','google_calendar_integrations','Staff can delete own Calendar integration', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','google_calendar_integrations','Deny INSERT for regular users', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','google_calendar_integrations','Service role full access', ARRAY['service_role']);

  -- membership_roles
  PERFORM public.set_policy_roles('public','membership_roles','membership_roles_read', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','membership_roles','membership_roles_admin_write', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','membership_roles','user_permission_profiles_delete', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','membership_roles','user_permission_profiles_update', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','membership_roles','user_permission_profiles_write', ARRAY['authenticated','dashboard_user']);

  -- org_memberships
  PERFORM public.set_policy_roles('public','org_memberships','memberships_read', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','org_memberships','memberships_admin_manage', ARRAY['authenticated','dashboard_user']);

  -- permissions
  PERFORM public.set_policy_roles('public','permissions','permissions_org_read', ARRAY['authenticated','dashboard_user','service_role']);
  PERFORM public.set_policy_roles('public','permissions','permissions_service_all', ARRAY['service_role']);

  -- sync_operations
  PERFORM public.set_policy_roles('public','sync_operations','sync_operations_read_in_org', ARRAY['authenticated','dashboard_user']);
  PERFORM public.set_policy_roles('public','sync_operations','sync_operations_service_role_all', ARRAY['service_role']);
END;
$$;

DROP FUNCTION IF EXISTS public.set_policy_roles(TEXT, TEXT, TEXT, TEXT[]);

COMMIT;
