-- Fix remaining RLS warnings that weren't caught by regex
-- This migration explicitly fixes policies that still have unwrapped auth calls

BEGIN;

-- Fix buildium_integrations policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'buildium_integrations'
  ) THEN
    DROP POLICY IF EXISTS buildium_integrations_org_read ON public.buildium_integrations;
    CREATE POLICY buildium_integrations_org_read
      ON public.buildium_integrations FOR SELECT
      USING (public.is_org_member((select auth.uid()), org_id));

    DROP POLICY IF EXISTS buildium_integrations_org_insert ON public.buildium_integrations;
    CREATE POLICY buildium_integrations_org_insert
      ON public.buildium_integrations FOR INSERT
      WITH CHECK (
        (select auth.uid()) IS NOT NULL
        AND public.is_org_member((select auth.uid()), org_id)
      );

    DROP POLICY IF EXISTS buildium_integrations_org_update ON public.buildium_integrations;
    CREATE POLICY buildium_integrations_org_update
      ON public.buildium_integrations FOR UPDATE
      USING (
        (select auth.uid()) IS NOT NULL
        AND public.is_org_member((select auth.uid()), org_id)
      )
      WITH CHECK (
        (select auth.uid()) IS NOT NULL
        AND public.is_org_member((select auth.uid()), org_id)
      );

    DROP POLICY IF EXISTS buildium_integrations_org_delete ON public.buildium_integrations;
    CREATE POLICY buildium_integrations_org_delete
      ON public.buildium_integrations FOR DELETE
      USING (
        (select auth.uid()) IS NOT NULL
        AND public.is_org_member((select auth.uid()), org_id)
      );
  END IF;
END $$;

-- Fix buildium_integration_audit_log policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'buildium_integration_audit_log'
    AND policyname = 'buildium_integration_audit_log_org_read'
  ) THEN
    DROP POLICY IF EXISTS buildium_integration_audit_log_org_read ON public.buildium_integration_audit_log;
    CREATE POLICY buildium_integration_audit_log_org_read
      ON public.buildium_integration_audit_log FOR SELECT
      USING (public.is_org_member((select auth.uid()), org_id));
  END IF;
END $$;

-- Fix compliance_items policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'compliance_items'
    AND policyname = 'compliance_items_delete'
  ) THEN
    DROP POLICY IF EXISTS compliance_items_delete ON public.compliance_items;
    CREATE POLICY compliance_items_delete ON public.compliance_items
      FOR DELETE TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid));
  END IF;
END $$;

-- Fix compliance_item_work_orders policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'compliance_item_work_orders'
  ) THEN
    DROP POLICY IF EXISTS compliance_item_work_orders_select ON public.compliance_item_work_orders;
    CREATE POLICY compliance_item_work_orders_select ON public.compliance_item_work_orders
      FOR SELECT TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_item_work_orders_insert ON public.compliance_item_work_orders;
    CREATE POLICY compliance_item_work_orders_insert ON public.compliance_item_work_orders
      FOR INSERT TO authenticated
      WITH CHECK (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_item_work_orders_update ON public.compliance_item_work_orders;
    CREATE POLICY compliance_item_work_orders_update ON public.compliance_item_work_orders
      FOR UPDATE TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid))
      WITH CHECK (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_item_work_orders_delete ON public.compliance_item_work_orders;
    CREATE POLICY compliance_item_work_orders_delete ON public.compliance_item_work_orders
      FOR DELETE TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid));
  END IF;
END $$;

-- Fix compliance_events policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'compliance_events'
  ) THEN
    DROP POLICY IF EXISTS compliance_events_select ON public.compliance_events;
    CREATE POLICY compliance_events_select ON public.compliance_events
      FOR SELECT TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_events_insert ON public.compliance_events;
    CREATE POLICY compliance_events_insert ON public.compliance_events
      FOR INSERT TO authenticated
      WITH CHECK (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_events_update ON public.compliance_events;
    CREATE POLICY compliance_events_update ON public.compliance_events
      FOR UPDATE TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid))
      WITH CHECK (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_events_delete ON public.compliance_events;
    CREATE POLICY compliance_events_delete ON public.compliance_events
      FOR DELETE TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid));
  END IF;
END $$;

-- Fix compliance_violations policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'compliance_violations'
  ) THEN
    DROP POLICY IF EXISTS compliance_violations_select ON public.compliance_violations;
    CREATE POLICY compliance_violations_select ON public.compliance_violations
      FOR SELECT TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_violations_insert ON public.compliance_violations;
    CREATE POLICY compliance_violations_insert ON public.compliance_violations
      FOR INSERT TO authenticated
      WITH CHECK (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_violations_update ON public.compliance_violations;
    CREATE POLICY compliance_violations_update ON public.compliance_violations
      FOR UPDATE TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid))
      WITH CHECK (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_violations_delete ON public.compliance_violations;
    CREATE POLICY compliance_violations_delete ON public.compliance_violations
      FOR DELETE TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid));
  END IF;
END $$;

-- Fix external_sync_state policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'external_sync_state'
  ) THEN
    DROP POLICY IF EXISTS external_sync_state_select ON public.external_sync_state;
    CREATE POLICY external_sync_state_select ON public.external_sync_state
      FOR SELECT TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS external_sync_state_insert ON public.external_sync_state;
    CREATE POLICY external_sync_state_insert ON public.external_sync_state
      FOR INSERT TO authenticated
      WITH CHECK (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS external_sync_state_update ON public.external_sync_state;
    CREATE POLICY external_sync_state_update ON public.external_sync_state
      FOR UPDATE TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid))
      WITH CHECK (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS external_sync_state_delete ON public.external_sync_state;
    CREATE POLICY external_sync_state_delete ON public.external_sync_state
      FOR DELETE TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid));
  END IF;
END $$;

-- Fix compliance_property_program_overrides policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'compliance_property_program_overrides'
  ) THEN
    DROP POLICY IF EXISTS compliance_property_program_overrides_select ON public.compliance_property_program_overrides;
    CREATE POLICY compliance_property_program_overrides_select ON public.compliance_property_program_overrides
      FOR SELECT TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_property_program_overrides_insert ON public.compliance_property_program_overrides;
    CREATE POLICY compliance_property_program_overrides_insert ON public.compliance_property_program_overrides
      FOR INSERT TO authenticated
      WITH CHECK (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_property_program_overrides_update ON public.compliance_property_program_overrides;
    CREATE POLICY compliance_property_program_overrides_update ON public.compliance_property_program_overrides
      FOR UPDATE TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid))
      WITH CHECK (org_id = (((select auth.jwt())->>'org_id')::uuid));

    DROP POLICY IF EXISTS compliance_property_program_overrides_delete ON public.compliance_property_program_overrides;
    CREATE POLICY compliance_property_program_overrides_delete ON public.compliance_property_program_overrides
      FOR DELETE TO authenticated
      USING (org_id = (((select auth.jwt())->>'org_id')::uuid));
  END IF;
END $$;

-- Fix service_plans policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'service_plans'
    AND policyname = 'service_plans_rw'
  ) THEN
    DROP POLICY IF EXISTS service_plans_rw ON public.service_plans;
    CREATE POLICY service_plans_rw ON public.service_plans
      FOR ALL TO authenticated
      USING (public.is_org_member((select auth.uid()), org_id))
      WITH CHECK (public.is_org_member((select auth.uid()), org_id));
  END IF;
END $$;

-- Fix service_plan_assignments policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'service_plan_assignments'
    AND policyname = 'service_plan_assignments_rw'
  ) THEN
    DROP POLICY IF EXISTS service_plan_assignments_rw ON public.service_plan_assignments;
    CREATE POLICY service_plan_assignments_rw ON public.service_plan_assignments
      FOR ALL TO authenticated
      USING (public.is_org_member((select auth.uid()), org_id))
      WITH CHECK (public.is_org_member((select auth.uid()), org_id));
  END IF;
END $$;

-- Fix service_plan_services policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'service_plan_services'
    AND policyname = 'service_plan_services_rw'
  ) THEN
    DROP POLICY IF EXISTS service_plan_services_rw ON public.service_plan_services;
    CREATE POLICY service_plan_services_rw ON public.service_plan_services
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.service_plans sp
          WHERE sp.id = service_plan_services.plan_id
            AND public.is_org_member((select auth.uid()), sp.org_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.service_plans sp
          WHERE sp.id = service_plan_services.plan_id
            AND public.is_org_member((select auth.uid()), sp.org_id)
        )
      );
  END IF;
END $$;

-- Fix service_offering_assignments policy (scoped via assignment_id -> service_plan_assignments.org_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'service_offering_assignments'
    AND policyname = 'service_offering_assignments_rw'
  ) THEN
    DROP POLICY IF EXISTS service_offering_assignments_rw ON public.service_offering_assignments;
    CREATE POLICY service_offering_assignments_rw ON public.service_offering_assignments
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.service_plan_assignments a
          WHERE a.id = service_offering_assignments.assignment_id
            AND public.is_org_member((select auth.uid()), a.org_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.service_plan_assignments a
          WHERE a.id = service_offering_assignments.assignment_id
            AND public.is_org_member((select auth.uid()), a.org_id)
        )
      );
  END IF;
END $$;

-- Fix billing_events policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'billing_events'
    AND policyname = 'billing_events_rw'
  ) THEN
    -- Check what the current policy looks like first
    -- If it uses auth calls, wrap them
    DROP POLICY IF EXISTS billing_events_rw ON public.billing_events;
    CREATE POLICY billing_events_rw ON public.billing_events
      FOR ALL TO authenticated
      USING (public.is_org_member((select auth.uid()), org_id))
      WITH CHECK (public.is_org_member((select auth.uid()), org_id));
  END IF;
END $$;

-- Fix multiple permissive policies: membership_roles
-- Combine membership_roles_read and membership_roles_admin_write for SELECT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'membership_roles'
    AND policyname IN ('membership_roles_read', 'membership_roles_admin_write')
  ) THEN
    -- Drop all existing policies and recreate with combined logic
    DROP POLICY IF EXISTS membership_roles_read ON public.membership_roles;
    DROP POLICY IF EXISTS membership_roles_admin_write ON public.membership_roles;
    DROP POLICY IF EXISTS membership_roles_admin_insert ON public.membership_roles;
    DROP POLICY IF EXISTS membership_roles_admin_update ON public.membership_roles;
    DROP POLICY IF EXISTS membership_roles_admin_delete ON public.membership_roles;
    
    -- Create a single SELECT policy that covers both cases
    CREATE POLICY membership_roles_read ON public.membership_roles
      FOR SELECT TO authenticated, dashboard_user
      USING (
        (select auth.uid()) = user_id
        OR public.is_org_member((select auth.uid()), org_id)
        OR public.is_org_admin((select auth.uid()), org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
    
    -- Create separate policies for write operations to avoid FOR ALL overlapping with SELECT
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

-- Fix multiple permissive policies: org_memberships
-- Combine memberships_read and memberships_admin_manage for SELECT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'org_memberships'
    AND policyname IN ('memberships_read', 'memberships_admin_manage')
  ) THEN
    -- Drop all existing policies and recreate with combined logic
    DROP POLICY IF EXISTS memberships_read ON public.org_memberships;
    DROP POLICY IF EXISTS memberships_admin_manage ON public.org_memberships;
    DROP POLICY IF EXISTS memberships_admin_insert ON public.org_memberships;
    DROP POLICY IF EXISTS memberships_admin_update ON public.org_memberships;
    DROP POLICY IF EXISTS memberships_admin_delete ON public.org_memberships;
    
    -- Create a single SELECT policy that covers both cases
    CREATE POLICY memberships_read ON public.org_memberships
      FOR SELECT TO authenticated, dashboard_user
      USING (
        user_id = (select auth.uid())
        OR public.is_org_admin((select auth.uid()), org_memberships.org_id)
        OR public.is_platform_admin((select auth.uid()))
      );
    
    -- Create separate policies for write operations to avoid FOR ALL overlapping with SELECT
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

