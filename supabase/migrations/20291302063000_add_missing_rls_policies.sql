-- Address Supabase lint: RLS enabled tables without policies.
-- Adds scoped policies using existing org membership helpers or restricts to service role.

BEGIN;

-- Appliances: scope by unit -> property org
DO $$
BEGIN
  IF to_regclass('public.appliances') IS NOT NULL THEN
    DROP POLICY IF EXISTS appliances_org_read ON public.appliances;
    DROP POLICY IF EXISTS appliances_org_write ON public.appliances;
    DROP POLICY IF EXISTS appliances_org_update ON public.appliances;
    DROP POLICY IF EXISTS appliances_org_delete ON public.appliances;

    CREATE POLICY appliances_org_read
      ON public.appliances
      FOR SELECT TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.units u
          WHERE u.id = appliances.unit_id
            AND public.is_org_member((select auth.uid()), u.org_id)
        )
      );

    CREATE POLICY appliances_org_write
      ON public.appliances
      FOR INSERT TO authenticated, dashboard_user
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.units u
          WHERE u.id = appliances.unit_id
            AND public.is_org_admin_or_manager((select auth.uid()), u.org_id)
        )
      );

    CREATE POLICY appliances_org_update
      ON public.appliances
      FOR UPDATE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.units u
          WHERE u.id = appliances.unit_id
            AND public.is_org_admin_or_manager((select auth.uid()), u.org_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.units u
          WHERE u.id = appliances.unit_id
            AND public.is_org_admin_or_manager((select auth.uid()), u.org_id)
        )
      );

    CREATE POLICY appliances_org_delete
      ON public.appliances
      FOR DELETE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.units u
          WHERE u.id = appliances.unit_id
            AND public.is_org_admin_or_manager((select auth.uid()), u.org_id)
        )
      );
  END IF;
END $$;

-- Inspections: scope by unit -> property org
DO $$
BEGIN
  IF to_regclass('public.inspections') IS NOT NULL THEN
    DROP POLICY IF EXISTS inspections_org_read ON public.inspections;
    DROP POLICY IF EXISTS inspections_org_write ON public.inspections;
    DROP POLICY IF EXISTS inspections_org_update ON public.inspections;
    DROP POLICY IF EXISTS inspections_org_delete ON public.inspections;

    CREATE POLICY inspections_org_read
      ON public.inspections
      FOR SELECT TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.units u
          WHERE u.id = inspections.unit_id
            AND public.is_org_member((select auth.uid()), u.org_id)
        )
      );

    CREATE POLICY inspections_org_write
      ON public.inspections
      FOR INSERT TO authenticated, dashboard_user
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.units u
          WHERE u.id = inspections.unit_id
            AND public.is_org_admin_or_manager((select auth.uid()), u.org_id)
        )
      );

    CREATE POLICY inspections_org_update
      ON public.inspections
      FOR UPDATE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.units u
          WHERE u.id = inspections.unit_id
            AND public.is_org_admin_or_manager((select auth.uid()), u.org_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.units u
          WHERE u.id = inspections.unit_id
            AND public.is_org_admin_or_manager((select auth.uid()), u.org_id)
        )
      );

    CREATE POLICY inspections_org_delete
      ON public.inspections
      FOR DELETE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.units u
          WHERE u.id = inspections.unit_id
            AND public.is_org_admin_or_manager((select auth.uid()), u.org_id)
        )
      );
  END IF;
END $$;

-- Rent schedules: scope by lease org
DO $$
BEGIN
  IF to_regclass('public.rent_schedules') IS NOT NULL THEN
    DROP POLICY IF EXISTS rent_schedules_org_read ON public.rent_schedules;
    DROP POLICY IF EXISTS rent_schedules_org_write ON public.rent_schedules;
    DROP POLICY IF EXISTS rent_schedules_org_update ON public.rent_schedules;
    DROP POLICY IF EXISTS rent_schedules_org_delete ON public.rent_schedules;

    CREATE POLICY rent_schedules_org_read
      ON public.rent_schedules
      FOR SELECT TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.lease l
          WHERE l.id = rent_schedules.lease_id
            AND public.is_org_member((select auth.uid()), l.org_id)
        )
      );

    CREATE POLICY rent_schedules_org_write
      ON public.rent_schedules
      FOR INSERT TO authenticated, dashboard_user
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.lease l
          WHERE l.id = rent_schedules.lease_id
            AND public.is_org_admin_or_manager((select auth.uid()), l.org_id)
        )
      );

    CREATE POLICY rent_schedules_org_update
      ON public.rent_schedules
      FOR UPDATE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.lease l
          WHERE l.id = rent_schedules.lease_id
            AND public.is_org_admin_or_manager((select auth.uid()), l.org_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.lease l
          WHERE l.id = rent_schedules.lease_id
            AND public.is_org_admin_or_manager((select auth.uid()), l.org_id)
        )
      );

    CREATE POLICY rent_schedules_org_delete
      ON public.rent_schedules
      FOR DELETE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.lease l
          WHERE l.id = rent_schedules.lease_id
            AND public.is_org_admin_or_manager((select auth.uid()), l.org_id)
        )
      );
  END IF;
END $$;

-- Tasks: derive org via property/unit/lease/monthly log
DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    DROP POLICY IF EXISTS tasks_org_read ON public.tasks;
    DROP POLICY IF EXISTS tasks_org_write ON public.tasks;
    DROP POLICY IF EXISTS tasks_org_update ON public.tasks;
    DROP POLICY IF EXISTS tasks_org_delete ON public.tasks;

    CREATE POLICY tasks_org_read
      ON public.tasks
      FOR SELECT TO authenticated, dashboard_user
      USING (
        public.is_org_member(
          (select auth.uid()),
          coalesce(
            (select p.org_id from public.properties p where p.id = tasks.property_id),
            (select u.org_id from public.units u where u.id = tasks.unit_id),
            (select l.org_id from public.lease l where l.id = tasks.lease_id),
            (select ml.org_id from public.monthly_logs ml where ml.id = tasks.monthly_log_id)
          )
        )
      );

    CREATE POLICY tasks_org_write
      ON public.tasks
      FOR INSERT TO authenticated, dashboard_user
      WITH CHECK (
        public.is_org_admin_or_manager(
          (select auth.uid()),
          coalesce(
            (select p.org_id from public.properties p where p.id = tasks.property_id),
            (select u.org_id from public.units u where u.id = tasks.unit_id),
            (select l.org_id from public.lease l where l.id = tasks.lease_id),
            (select ml.org_id from public.monthly_logs ml where ml.id = tasks.monthly_log_id)
          )
        )
      );

    CREATE POLICY tasks_org_update
      ON public.tasks
      FOR UPDATE TO authenticated, dashboard_user
      USING (
        public.is_org_admin_or_manager(
          (select auth.uid()),
          coalesce(
            (select p.org_id from public.properties p where p.id = tasks.property_id),
            (select u.org_id from public.units u where u.id = tasks.unit_id),
            (select l.org_id from public.lease l where l.id = tasks.lease_id),
            (select ml.org_id from public.monthly_logs ml where ml.id = tasks.monthly_log_id)
          )
        )
      )
      WITH CHECK (
        public.is_org_admin_or_manager(
          (select auth.uid()),
          coalesce(
            (select p.org_id from public.properties p where p.id = tasks.property_id),
            (select u.org_id from public.units u where u.id = tasks.unit_id),
            (select l.org_id from public.lease l where l.id = tasks.lease_id),
            (select ml.org_id from public.monthly_logs ml where ml.id = tasks.monthly_log_id)
          )
        )
      );

    CREATE POLICY tasks_org_delete
      ON public.tasks
      FOR DELETE TO authenticated, dashboard_user
      USING (
        public.is_org_admin_or_manager(
          (select auth.uid()),
          coalesce(
            (select p.org_id from public.properties p where p.id = tasks.property_id),
            (select u.org_id from public.units u where u.id = tasks.unit_id),
            (select l.org_id from public.lease l where l.id = tasks.lease_id),
            (select ml.org_id from public.monthly_logs ml where ml.id = tasks.monthly_log_id)
          )
        )
      );
  END IF;
END $$;

-- Task history: scope via related task org context
DO $$
BEGIN
  IF to_regclass('public.task_history') IS NOT NULL THEN
    DROP POLICY IF EXISTS task_history_org_read ON public.task_history;
    DROP POLICY IF EXISTS task_history_org_write ON public.task_history;
    DROP POLICY IF EXISTS task_history_org_update ON public.task_history;
    DROP POLICY IF EXISTS task_history_org_delete ON public.task_history;

    CREATE POLICY task_history_org_read
      ON public.task_history
      FOR SELECT TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          WHERE t.id = task_history.task_id
            AND public.is_org_member(
              (select auth.uid()),
              coalesce(
                (select p.org_id from public.properties p where p.id = t.property_id),
                (select u.org_id from public.units u where u.id = t.unit_id),
                (select l.org_id from public.lease l where l.id = t.lease_id),
                (select ml.org_id from public.monthly_logs ml where ml.id = t.monthly_log_id)
              )
            )
        )
      );

    CREATE POLICY task_history_org_write
      ON public.task_history
      FOR INSERT TO authenticated, dashboard_user
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          WHERE t.id = task_history.task_id
            AND public.is_org_admin_or_manager(
              (select auth.uid()),
              coalesce(
                (select p.org_id from public.properties p where p.id = t.property_id),
                (select u.org_id from public.units u where u.id = t.unit_id),
                (select l.org_id from public.lease l where l.id = t.lease_id),
                (select ml.org_id from public.monthly_logs ml where ml.id = t.monthly_log_id)
              )
            )
        )
      );

    CREATE POLICY task_history_org_update
      ON public.task_history
      FOR UPDATE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          WHERE t.id = task_history.task_id
            AND public.is_org_admin_or_manager(
              (select auth.uid()),
              coalesce(
                (select p.org_id from public.properties p where p.id = t.property_id),
                (select u.org_id from public.units u where u.id = t.unit_id),
                (select l.org_id from public.lease l where l.id = t.lease_id),
                (select ml.org_id from public.monthly_logs ml where ml.id = t.monthly_log_id)
              )
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          WHERE t.id = task_history.task_id
            AND public.is_org_admin_or_manager(
              (select auth.uid()),
              coalesce(
                (select p.org_id from public.properties p where p.id = t.property_id),
                (select u.org_id from public.units u where u.id = t.unit_id),
                (select l.org_id from public.lease l where l.id = t.lease_id),
                (select ml.org_id from public.monthly_logs ml where ml.id = t.monthly_log_id)
              )
            )
        )
      );

    CREATE POLICY task_history_org_delete
      ON public.task_history
      FOR DELETE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          WHERE t.id = task_history.task_id
            AND public.is_org_admin_or_manager(
              (select auth.uid()),
              coalesce(
                (select p.org_id from public.properties p where p.id = t.property_id),
                (select u.org_id from public.units u where u.id = t.unit_id),
                (select l.org_id from public.lease l where l.id = t.lease_id),
                (select ml.org_id from public.monthly_logs ml where ml.id = t.monthly_log_id)
              )
            )
        )
      );
  END IF;
END $$;

-- Transaction lines: derive org via transaction/property/unit/lease
DO $$
BEGIN
  IF to_regclass('public.transaction_lines') IS NOT NULL THEN
    DROP POLICY IF EXISTS transaction_lines_org_read ON public.transaction_lines;
    DROP POLICY IF EXISTS transaction_lines_org_write ON public.transaction_lines;
    DROP POLICY IF EXISTS transaction_lines_org_update ON public.transaction_lines;
    DROP POLICY IF EXISTS transaction_lines_org_delete ON public.transaction_lines;

    CREATE POLICY transaction_lines_org_read
      ON public.transaction_lines
      FOR SELECT TO authenticated, dashboard_user
      USING (
        public.is_org_member(
          (select auth.uid()),
          coalesce(
            (select t.org_id from public.transactions t where t.id = transaction_lines.transaction_id),
            (select p.org_id from public.properties p where p.id = transaction_lines.property_id),
            (select u.org_id from public.units u where u.id = transaction_lines.unit_id),
            (select l.org_id from public.lease l where l.id = transaction_lines.lease_id)
          )
        )
      );

    CREATE POLICY transaction_lines_org_write
      ON public.transaction_lines
      FOR INSERT TO authenticated, dashboard_user
      WITH CHECK (
        public.is_org_admin_or_manager(
          (select auth.uid()),
          coalesce(
            (select t.org_id from public.transactions t where t.id = transaction_lines.transaction_id),
            (select p.org_id from public.properties p where p.id = transaction_lines.property_id),
            (select u.org_id from public.units u where u.id = transaction_lines.unit_id),
            (select l.org_id from public.lease l where l.id = transaction_lines.lease_id)
          )
        )
      );

    CREATE POLICY transaction_lines_org_update
      ON public.transaction_lines
      FOR UPDATE TO authenticated, dashboard_user
      USING (
        public.is_org_admin_or_manager(
          (select auth.uid()),
          coalesce(
            (select t.org_id from public.transactions t where t.id = transaction_lines.transaction_id),
            (select p.org_id from public.properties p where p.id = transaction_lines.property_id),
            (select u.org_id from public.units u where u.id = transaction_lines.unit_id),
            (select l.org_id from public.lease l where l.id = transaction_lines.lease_id)
          )
        )
      )
      WITH CHECK (
        public.is_org_admin_or_manager(
          (select auth.uid()),
          coalesce(
            (select t.org_id from public.transactions t where t.id = transaction_lines.transaction_id),
            (select p.org_id from public.properties p where p.id = transaction_lines.property_id),
            (select u.org_id from public.units u where u.id = transaction_lines.unit_id),
            (select l.org_id from public.lease l where l.id = transaction_lines.lease_id)
          )
        )
      );

    CREATE POLICY transaction_lines_org_delete
      ON public.transaction_lines
      FOR DELETE TO authenticated, dashboard_user
      USING (
        public.is_org_admin_or_manager(
          (select auth.uid()),
          coalesce(
            (select t.org_id from public.transactions t where t.id = transaction_lines.transaction_id),
            (select p.org_id from public.properties p where p.id = transaction_lines.property_id),
            (select u.org_id from public.units u where u.id = transaction_lines.unit_id),
            (select l.org_id from public.lease l where l.id = transaction_lines.lease_id)
          )
        )
      );
  END IF;
END $$;

-- Property staff: scope by property org
DO $$
BEGIN
  IF to_regclass('public.property_staff') IS NOT NULL THEN
    DROP POLICY IF EXISTS property_staff_org_read ON public.property_staff;
    DROP POLICY IF EXISTS property_staff_org_write ON public.property_staff;
    DROP POLICY IF EXISTS property_staff_org_update ON public.property_staff;
    DROP POLICY IF EXISTS property_staff_org_delete ON public.property_staff;

    CREATE POLICY property_staff_org_read
      ON public.property_staff
      FOR SELECT TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = property_staff.property_id
            AND public.is_org_member((select auth.uid()), p.org_id)
        )
      );

    CREATE POLICY property_staff_org_write
      ON public.property_staff
      FOR INSERT TO authenticated, dashboard_user
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = property_staff.property_id
            AND public.is_org_admin_or_manager((select auth.uid()), p.org_id)
        )
      );

    CREATE POLICY property_staff_org_update
      ON public.property_staff
      FOR UPDATE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = property_staff.property_id
            AND public.is_org_admin_or_manager((select auth.uid()), p.org_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = property_staff.property_id
            AND public.is_org_admin_or_manager((select auth.uid()), p.org_id)
        )
      );

    CREATE POLICY property_staff_org_delete
      ON public.property_staff
      FOR DELETE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = property_staff.property_id
            AND public.is_org_admin_or_manager((select auth.uid()), p.org_id)
        )
      );
  END IF;
END $$;

-- Property ownerships cache: read scoped to property org, writes handled by service role
DO $$
BEGIN
  IF to_regclass('public.property_ownerships_cache') IS NOT NULL THEN
    DROP POLICY IF EXISTS property_ownerships_cache_read ON public.property_ownerships_cache;
    DROP POLICY IF EXISTS property_ownerships_cache_service_manage ON public.property_ownerships_cache;

    CREATE POLICY property_ownerships_cache_read
      ON public.property_ownerships_cache
      FOR SELECT TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = property_ownerships_cache.property_id
            AND public.is_org_member((select auth.uid()), p.org_id)
        )
      );

    CREATE POLICY property_ownerships_cache_service_manage
      ON public.property_ownerships_cache
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Organizations: members read, admins manage, service role create
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NOT NULL THEN
    DROP POLICY IF EXISTS organizations_member_read ON public.organizations;
    DROP POLICY IF EXISTS organizations_admin_update ON public.organizations;
    DROP POLICY IF EXISTS organizations_admin_delete ON public.organizations;
    DROP POLICY IF EXISTS organizations_service_insert ON public.organizations;

    CREATE POLICY organizations_member_read
      ON public.organizations
      FOR SELECT TO authenticated, dashboard_user
      USING (public.is_org_member((select auth.uid()), organizations.id));

    CREATE POLICY organizations_admin_update
      ON public.organizations
      FOR UPDATE TO authenticated, dashboard_user
      USING (public.is_org_admin_or_manager((select auth.uid()), organizations.id))
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), organizations.id));

    CREATE POLICY organizations_admin_delete
      ON public.organizations
      FOR DELETE TO authenticated, dashboard_user
      USING (public.is_org_admin_or_manager((select auth.uid()), organizations.id));

    CREATE POLICY organizations_service_insert
      ON public.organizations
      FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- Staff: allow reads for shared org context; manage via admin/service role
DO $$
BEGIN
  IF to_regclass('public.staff') IS NOT NULL THEN
    DROP POLICY IF EXISTS staff_org_read ON public.staff;
    DROP POLICY IF EXISTS staff_admin_update ON public.staff;
    DROP POLICY IF EXISTS staff_admin_delete ON public.staff;
    DROP POLICY IF EXISTS staff_service_insert ON public.staff;

    CREATE POLICY staff_org_read
      ON public.staff
      FOR SELECT TO authenticated, dashboard_user
      USING (
        -- Shared org membership via org_memberships
        EXISTS (
          SELECT 1
          FROM public.org_memberships m_user
          JOIN public.org_memberships m_staff
            ON m_staff.org_id = m_user.org_id
          WHERE m_user.user_id = (select auth.uid())
            AND m_staff.user_id = staff.user_id
        )
        OR
        -- Shared org via property assignments
        EXISTS (
          SELECT 1
          FROM public.property_staff ps
          JOIN public.properties p ON p.id = ps.property_id
          WHERE ps.staff_id = staff.id
            AND public.is_org_member((select auth.uid()), p.org_id)
        )
        OR staff.user_id = (select auth.uid())
      );

    CREATE POLICY staff_admin_update
      ON public.staff
      FOR UPDATE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.org_memberships m_user
          JOIN public.org_memberships m_staff
            ON m_staff.org_id = m_user.org_id
          WHERE m_user.user_id = (select auth.uid())
            AND m_staff.user_id = staff.user_id
            AND public.is_org_admin_or_manager((select auth.uid()), m_user.org_id)
        )
        OR
        EXISTS (
          SELECT 1
          FROM public.property_staff ps
          JOIN public.properties p ON p.id = ps.property_id
          WHERE ps.staff_id = staff.id
            AND public.is_org_admin_or_manager((select auth.uid()), p.org_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.org_memberships m_user
          JOIN public.org_memberships m_staff
            ON m_staff.org_id = m_user.org_id
          WHERE m_user.user_id = (select auth.uid())
            AND m_staff.user_id = staff.user_id
            AND public.is_org_admin_or_manager((select auth.uid()), m_user.org_id)
        )
        OR
        EXISTS (
          SELECT 1
          FROM public.property_staff ps
          JOIN public.properties p ON p.id = ps.property_id
          WHERE ps.staff_id = staff.id
            AND public.is_org_admin_or_manager((select auth.uid()), p.org_id)
        )
      );

    CREATE POLICY staff_admin_delete
      ON public.staff
      FOR DELETE TO authenticated, dashboard_user
      USING (
        EXISTS (
          SELECT 1
          FROM public.org_memberships m_user
          JOIN public.org_memberships m_staff
            ON m_staff.org_id = m_user.org_id
          WHERE m_user.user_id = (select auth.uid())
            AND m_staff.user_id = staff.user_id
            AND public.is_org_admin_or_manager((select auth.uid()), m_user.org_id)
        )
        OR
        EXISTS (
          SELECT 1
          FROM public.property_staff ps
          JOIN public.properties p ON p.id = ps.property_id
          WHERE ps.staff_id = staff.id
            AND public.is_org_admin_or_manager((select auth.uid()), p.org_id)
        )
      );

    CREATE POLICY staff_service_insert
      ON public.staff
      FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- Categories: allow authenticated reads; writes handled by service role bypass
DO $$
BEGIN
  IF to_regclass('public.bill_categories') IS NOT NULL THEN
    DROP POLICY IF EXISTS bill_categories_auth_read ON public.bill_categories;
    CREATE POLICY bill_categories_auth_read
      ON public.bill_categories
      FOR SELECT TO authenticated, dashboard_user
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.vendor_categories') IS NOT NULL THEN
    DROP POLICY IF EXISTS vendor_categories_auth_read ON public.vendor_categories;
    CREATE POLICY vendor_categories_auth_read
      ON public.vendor_categories
      FOR SELECT TO authenticated, dashboard_user
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.task_categories') IS NOT NULL THEN
    DROP POLICY IF EXISTS task_categories_auth_read ON public.task_categories;
    CREATE POLICY task_categories_auth_read
      ON public.task_categories
      FOR SELECT TO authenticated, dashboard_user
      USING (true);
  END IF;
END $$;

-- Vendors: allow authenticated reads, service role manages writes
DO $$
BEGIN
  IF to_regclass('public.vendors') IS NOT NULL THEN
    DROP POLICY IF EXISTS vendors_auth_read ON public.vendors;
    DROP POLICY IF EXISTS vendors_service_manage ON public.vendors;

    CREATE POLICY vendors_auth_read
      ON public.vendors
      FOR SELECT TO authenticated, dashboard_user
      USING (true);

    CREATE POLICY vendors_service_manage
      ON public.vendors
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Buildium API log: restrict to service role
DO $$
BEGIN
  IF to_regclass('public.buildium_api_log') IS NOT NULL THEN
    DROP POLICY IF EXISTS buildium_api_log_service_only ON public.buildium_api_log;
    CREATE POLICY buildium_api_log_service_only
      ON public.buildium_api_log
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMIT;

