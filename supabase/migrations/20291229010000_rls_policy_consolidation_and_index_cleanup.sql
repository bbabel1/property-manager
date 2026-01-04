-- RLS policy consolidation and duplicate index cleanup
-- - Collapse overlapping permissive policies into single policies per table/action
-- - Wrap auth.*() calls in policy predicates with (select ...) to avoid initplans
-- - Drop remaining duplicate indexes

BEGIN;

-- gl_accounts: consolidate SELECT and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gl_accounts') THEN
    DROP POLICY IF EXISTS gl_accounts_org_member_read ON public.gl_accounts;
    DROP POLICY IF EXISTS gl_accounts_org_read ON public.gl_accounts;
    DROP POLICY IF EXISTS gl_accounts_org_update ON public.gl_accounts;
    DROP POLICY IF EXISTS gl_accounts_org_write ON public.gl_accounts;
    CREATE POLICY gl_accounts_org_read
      ON public.gl_accounts FOR SELECT
      USING (public.is_org_member((select auth.uid()), org_id));

    CREATE POLICY gl_accounts_org_update
      ON public.gl_accounts FOR UPDATE
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id));

    CREATE POLICY gl_accounts_org_write
      ON public.gl_accounts FOR INSERT
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id));
  END IF;
END $$;

-- lease_contacts: consolidate SELECT and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lease_contacts') THEN
    DROP POLICY IF EXISTS lease_contacts_org_member_read ON public.lease_contacts;
    DROP POLICY IF EXISTS lease_contacts_org_read ON public.lease_contacts;
    DROP POLICY IF EXISTS lease_contacts_visible_to_tenant ON public.lease_contacts;
    DROP POLICY IF EXISTS lease_contacts_read ON public.lease_contacts;
    DROP POLICY IF EXISTS lease_contacts_org_update ON public.lease_contacts;
    DROP POLICY IF EXISTS lease_contacts_org_write ON public.lease_contacts;
    CREATE POLICY lease_contacts_read
      ON public.lease_contacts FOR SELECT
      USING (
        public.is_org_member((select auth.uid()), org_id)
        OR EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE t.id = lease_contacts.tenant_id
            AND t.user_id = (select auth.uid())
        )
      );

    CREATE POLICY lease_contacts_org_update
      ON public.lease_contacts FOR UPDATE
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id));

    CREATE POLICY lease_contacts_org_write
      ON public.lease_contacts FOR INSERT
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id));
  END IF;
END $$;

-- membership_roles: consolidate SELECT and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'membership_roles') THEN
    DROP POLICY IF EXISTS membership_roles_self_read ON public.membership_roles;
    DROP POLICY IF EXISTS user_permission_profiles_read ON public.membership_roles;
    DROP POLICY IF EXISTS membership_roles_read ON public.membership_roles;
    DROP POLICY IF EXISTS membership_roles_admin_write ON public.membership_roles;
    DROP POLICY IF EXISTS user_permission_profiles_delete ON public.membership_roles;
    DROP POLICY IF EXISTS user_permission_profiles_update ON public.membership_roles;
    DROP POLICY IF EXISTS user_permission_profiles_write ON public.membership_roles;
    CREATE POLICY membership_roles_read
      ON public.membership_roles FOR SELECT
      USING (
        (select auth.uid()) = user_id
        OR public.is_org_member((select auth.uid()), org_id)
      );

    CREATE POLICY membership_roles_admin_write
      ON public.membership_roles FOR ALL
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id) OR public.is_org_admin((select auth.uid()), org_id))
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id) OR public.is_org_admin((select auth.uid()), org_id));

    CREATE POLICY user_permission_profiles_delete
      ON public.membership_roles FOR DELETE
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id) OR public.is_platform_admin((select auth.uid())));

    CREATE POLICY user_permission_profiles_update
      ON public.membership_roles FOR UPDATE
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id) OR public.is_platform_admin((select auth.uid())))
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id) OR public.is_platform_admin((select auth.uid())));

    CREATE POLICY user_permission_profiles_write
      ON public.membership_roles FOR INSERT
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id) OR public.is_platform_admin((select auth.uid())));
  END IF;
END $$;

-- org_memberships: consolidate SELECT and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'org_memberships') THEN
    DROP POLICY IF EXISTS memberships_org_read ON public.org_memberships;
    DROP POLICY IF EXISTS memberships_self_read ON public.org_memberships;
    DROP POLICY IF EXISTS memberships_read ON public.org_memberships;
    DROP POLICY IF EXISTS memberships_admin_manage ON public.org_memberships;
    CREATE POLICY memberships_read
      ON public.org_memberships FOR SELECT
      USING (
        public.is_org_member((select auth.uid()), org_id)
        OR user_id = (select auth.uid())
      );

    CREATE POLICY memberships_admin_manage
      ON public.org_memberships FOR ALL
      USING (public.is_org_admin((select auth.uid()), org_id))
      WITH CHECK (public.is_org_admin((select auth.uid()), org_id));
  END IF;
END $$;

-- owners: consolidate SELECT and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'owners') THEN
    DROP POLICY IF EXISTS owners_consolidated_read ON public.owners;
    DROP POLICY IF EXISTS owners_org_member_read ON public.owners;
    DROP POLICY IF EXISTS owners_org_read ON public.owners;
    DROP POLICY IF EXISTS owners_self ON public.owners;
    DROP POLICY IF EXISTS owners_read ON public.owners;
    DROP POLICY IF EXISTS owners_org_update ON public.owners;
    DROP POLICY IF EXISTS owners_org_write ON public.owners;
    CREATE POLICY owners_read
      ON public.owners FOR SELECT
      USING (
        owners.user_id = (select auth.uid())
        OR public.is_org_member((select auth.uid()), org_id)
      );

    CREATE POLICY owners_org_update
      ON public.owners FOR UPDATE
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id));

    CREATE POLICY owners_org_write
      ON public.owners FOR INSERT
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id));
  END IF;
END $$;

-- ownerships: consolidate SELECT and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ownerships') THEN
    DROP POLICY IF EXISTS ownerships_org_member_read ON public.ownerships;
    DROP POLICY IF EXISTS ownerships_org_read ON public.ownerships;
    DROP POLICY IF EXISTS ownerships_read ON public.ownerships;
    DROP POLICY IF EXISTS ownerships_org_update ON public.ownerships;
    DROP POLICY IF EXISTS ownerships_org_write ON public.ownerships;
    CREATE POLICY ownerships_read
      ON public.ownerships FOR SELECT
      USING (public.is_org_member((select auth.uid()), org_id));

    CREATE POLICY ownerships_org_update
      ON public.ownerships FOR UPDATE
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id));

    CREATE POLICY ownerships_org_write
      ON public.ownerships FOR INSERT
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id));
  END IF;
END $$;

-- profiles: consolidate ALL into one self policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP POLICY IF EXISTS profiles_consolidated_all ON public.profiles;
    DROP POLICY IF EXISTS profiles_self_all ON public.profiles;
    DROP POLICY IF EXISTS profiles_read ON public.profiles;
    CREATE POLICY profiles_self_all
      ON public.profiles FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- properties: consolidate SELECT and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'properties') THEN
    DROP POLICY IF EXISTS properties_org_member_read ON public.properties;
    DROP POLICY IF EXISTS properties_org_read ON public.properties;
    DROP POLICY IF EXISTS properties_visible_to_owner ON public.properties;
    DROP POLICY IF EXISTS properties_read ON public.properties;
    DROP POLICY IF EXISTS properties_org_update ON public.properties;
    DROP POLICY IF EXISTS properties_org_write ON public.properties;
    CREATE POLICY properties_read
      ON public.properties FOR SELECT
      USING (
        public.is_org_member((select auth.uid()), org_id)
        OR EXISTS (
          SELECT 1
          FROM public.ownerships po
          JOIN public.owners o ON o.id = po.owner_id
          WHERE po.property_id = properties.id
            AND o.user_id = (select auth.uid())
        )
      );

    CREATE POLICY properties_org_update
      ON public.properties FOR UPDATE
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id));

    CREATE POLICY properties_org_write
      ON public.properties FOR INSERT
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id));
  END IF;
END $$;

-- roles: remove duplicate permission_profiles_* and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
    DROP POLICY IF EXISTS permission_profiles_delete ON public.roles;
    DROP POLICY IF EXISTS permission_profiles_read ON public.roles;
    DROP POLICY IF EXISTS permission_profiles_update ON public.roles;
    DROP POLICY IF EXISTS permission_profiles_write ON public.roles;
    DROP POLICY IF EXISTS roles_delete ON public.roles;
    DROP POLICY IF EXISTS roles_read ON public.roles;
    DROP POLICY IF EXISTS roles_update ON public.roles;
    DROP POLICY IF EXISTS roles_write ON public.roles;

    CREATE POLICY roles_read
      ON public.roles FOR SELECT
      USING (
        ((org_id IS NULL) AND public.is_platform_admin((select auth.uid())))
        OR ((org_id IS NOT NULL) AND public.is_org_member((select auth.uid()), org_id))
      );

    CREATE POLICY roles_write
      ON public.roles FOR INSERT
      WITH CHECK (
        (org_id IS NOT NULL)
        AND (public.is_org_admin_or_manager((select auth.uid()), org_id) OR public.is_platform_admin((select auth.uid())))
      );

    CREATE POLICY roles_update
      ON public.roles FOR UPDATE
      USING (
        ((org_id IS NULL) AND public.is_platform_admin((select auth.uid())))
        OR ((org_id IS NOT NULL) AND public.is_org_admin_or_manager((select auth.uid()), org_id))
      )
      WITH CHECK (
        (org_id IS NOT NULL)
        AND (public.is_org_admin_or_manager((select auth.uid()), org_id) OR public.is_platform_admin((select auth.uid())))
      );

    CREATE POLICY roles_delete
      ON public.roles FOR DELETE
      USING (
        ((org_id IS NULL) AND public.is_platform_admin((select auth.uid())))
        OR ((org_id IS NOT NULL) AND public.is_org_admin_or_manager((select auth.uid()), org_id))
      );
  END IF;
END $$;

-- tenants: consolidate SELECT and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    DROP POLICY IF EXISTS tenants_org_member_read ON public.tenants;
    DROP POLICY IF EXISTS tenants_org_read ON public.tenants;
    DROP POLICY IF EXISTS tenants_read ON public.tenants;
    DROP POLICY IF EXISTS tenants_org_update ON public.tenants;
    DROP POLICY IF EXISTS tenants_org_write ON public.tenants;
    CREATE POLICY tenants_read
      ON public.tenants FOR SELECT
      USING (public.is_org_member((select auth.uid()), org_id));

    CREATE POLICY tenants_org_update
      ON public.tenants FOR UPDATE
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id));

    CREATE POLICY tenants_org_write
      ON public.tenants FOR INSERT
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id));
  END IF;
END $$;

-- transactions: consolidate SELECT and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    DROP POLICY IF EXISTS transactions_org_member_read ON public.transactions;
    DROP POLICY IF EXISTS transactions_org_read ON public.transactions;
    DROP POLICY IF EXISTS transactions_read ON public.transactions;
    DROP POLICY IF EXISTS transactions_org_update ON public.transactions;
    DROP POLICY IF EXISTS transactions_org_write ON public.transactions;
    CREATE POLICY transactions_read
      ON public.transactions FOR SELECT
      USING (public.is_org_member((select auth.uid()), org_id));

    CREATE POLICY transactions_org_update
      ON public.transactions FOR UPDATE
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id));

    CREATE POLICY transactions_org_write
      ON public.transactions FOR INSERT
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id));
  END IF;
END $$;

-- units: consolidate SELECT and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'units') THEN
    DROP POLICY IF EXISTS units_org_member_read ON public.units;
    DROP POLICY IF EXISTS units_org_read ON public.units;
    DROP POLICY IF EXISTS units_read ON public.units;
    DROP POLICY IF EXISTS units_org_update ON public.units;
    DROP POLICY IF EXISTS units_org_write ON public.units;
    CREATE POLICY units_read
      ON public.units FOR SELECT
      USING (public.is_org_member((select auth.uid()), org_id));

    CREATE POLICY units_org_update
      ON public.units FOR UPDATE
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id));

    CREATE POLICY units_org_write
      ON public.units FOR INSERT
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id));
  END IF;
END $$;

-- work_orders: consolidate SELECT and wrap auth.*()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_orders') THEN
    DROP POLICY IF EXISTS work_orders_org_member_read ON public.work_orders;
    DROP POLICY IF EXISTS work_orders_org_read ON public.work_orders;
    DROP POLICY IF EXISTS work_orders_read ON public.work_orders;
    DROP POLICY IF EXISTS work_orders_org_update ON public.work_orders;
    DROP POLICY IF EXISTS work_orders_org_write ON public.work_orders;
    CREATE POLICY work_orders_read
      ON public.work_orders FOR SELECT
      USING (public.is_org_member((select auth.uid()), org_id));

    CREATE POLICY work_orders_org_update
      ON public.work_orders FOR UPDATE
      USING (public.is_org_admin_or_manager((select auth.uid()), org_id));

    CREATE POLICY work_orders_org_write
      ON public.work_orders FOR INSERT
      WITH CHECK (public.is_org_admin_or_manager((select auth.uid()), org_id));
  END IF;
END $$;

-- Duplicate index cleanup (keep unique/canonical versions)
DROP INDEX IF EXISTS public."Lease_propertyId_idx";
DROP INDEX IF EXISTS public.idx_buildium_sync_entity;
DROP INDEX IF EXISTS public.idx_webhook_events_created;
DROP INDEX IF EXISTS public.idx_gl_accounts_buildium_id;
DROP INDEX IF EXISTS public.idx_owners_contact_id;
DROP INDEX IF EXISTS public.idx_properties_buildium_property_id;
DROP INDEX IF EXISTS public.idx_task_categories_buildium_id;
DROP INDEX IF EXISTS public.idx_task_history_buildium_id;
DROP INDEX IF EXISTS public.idx_tasks_buildium_id;
DROP INDEX IF EXISTS public.idx_tenants_buildium_id;
DROP INDEX IF EXISTS public.idx_transaction_lines_transaction_id;
DROP INDEX IF EXISTS public.idx_organizations_slug;
DROP INDEX IF EXISTS public.permission_profile_permissions_role_idx;
DROP INDEX IF EXISTS public.permission_profile_permissions_permission_idx;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permission_profile_permissions_public_id_key') THEN
    ALTER TABLE public.role_permissions DROP CONSTRAINT permission_profile_permissions_public_id_key;
  ELSE
    DROP INDEX IF EXISTS public.permission_profile_permissions_public_id_key;
  END IF;
END $$;
DROP INDEX IF EXISTS public.permission_profile_permissions_profile_idx;
DROP INDEX IF EXISTS public.gmail_integrations_staff_id_idx;
DROP INDEX IF EXISTS public.idx_email_templates_org_key;
DROP INDEX IF EXISTS public.idx_compliance_program_templates_code;
DROP INDEX IF EXISTS public.idx_transactions_buildium_transaction_id;
DROP INDEX IF EXISTS public.idx_units_buildium_id;
DROP INDEX IF EXISTS public.idx_vendor_categories_buildium_id;
DROP INDEX IF EXISTS public.idx_vendors_buildium_id;
DROP INDEX IF EXISTS public.idx_work_orders_buildium_id;

COMMIT;
