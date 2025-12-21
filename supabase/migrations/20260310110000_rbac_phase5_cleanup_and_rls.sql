-- Phase 5: Cleanup legacy columns, tighten role_permissions, refresh RLS references
-- Assumes Phase 2-4 migrations are applied and app is moving to membership_roles/roles.

begin;

-- 1) Drop legacy org_memberships.role text column
-- Note: CASCADE will drop dependent RLS policies that directly reference this column.
-- Those policies should be updated in a follow-up migration to use helper functions
-- (is_org_admin, is_org_admin_or_manager) instead of direct column references.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'org_memberships'
      and column_name = 'role'
  ) then
    -- Use CASCADE to drop dependent objects (RLS policies that reference org_memberships.role)
    alter table public.org_memberships drop column role cascade;
  end if;
end$$;

-- 2) Remove legacy permission text column from role_permissions (now using permission_id)
-- First update the compatibility view to not reference the legacy column
drop view if exists public.permission_profile_permissions;
create or replace view public.permission_profile_permissions as
  select
    role_id as profile_id,
    permission_id,
    (select key from public.permissions where id = permission_id) as permission,
    created_at,
    updated_at
  from public.role_permissions;

-- Now drop the legacy column
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'role_permissions'
      and column_name = 'permission'
  ) then
    alter table public.role_permissions drop column permission cascade;
  end if;
end$$;

-- 3) Drop org_membership_roles table (replaced by membership_roles)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'org_membership_roles'
  ) then
    drop table public.org_membership_roles;
  end if;
end$$;

-- 4) Refresh RLS policies to reference membership_roles
-- Note: Policies that referenced user_permission_profiles are covered by the view alias,
-- but we create policies on the real table to avoid view recursion surprises.

-- membership_roles RLS
alter table public.membership_roles enable row level security;

drop policy if exists membership_roles_self_read on public.membership_roles;
create policy membership_roles_self_read on public.membership_roles
  for select using (auth.uid() = user_id);

drop policy if exists membership_roles_admin_write on public.membership_roles;
create policy membership_roles_admin_write on public.membership_roles
  for all
  using (
    public.is_org_admin_or_manager(auth.uid(), org_id)
    or public.is_org_admin(auth.uid(), org_id)
  )
  with check (
    public.is_org_admin_or_manager(auth.uid(), org_id)
    or public.is_org_admin(auth.uid(), org_id)
  );

-- roles RLS (if not already tightened in prior migrations)
alter table public.roles enable row level security;

drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles
  for select using (
    (org_id is null and public.is_platform_admin(auth.uid()))
    or (org_id is not null and public.is_org_member(auth.uid(), org_id))
  );

drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles
  for insert with check (
    org_id is not null
    and (
      public.is_org_admin_or_manager(auth.uid(), org_id)
      or public.is_platform_admin(auth.uid())
    )
  );

drop policy if exists roles_update on public.roles;
create policy roles_update on public.roles
  for update using (
    (org_id is null and public.is_platform_admin(auth.uid()))
    or (org_id is not null and public.is_org_admin_or_manager(auth.uid(), org_id))
  )
  with check (
    org_id is not null
    and (
      public.is_org_admin_or_manager(auth.uid(), org_id)
      or public.is_platform_admin(auth.uid())
    )
  );

drop policy if exists roles_delete on public.roles;
create policy roles_delete on public.roles
  for delete using (
    (org_id is null and public.is_platform_admin(auth.uid()))
    or (org_id is not null and public.is_org_admin_or_manager(auth.uid(), org_id))
  );

commit;
