-- Phase 3: Rename RBAC tables/columns to canonical names and add compatibility views

begin;

-- 1) Rename tables to final names
alter table if exists public.permission_profiles rename to roles;
alter table if exists public.permission_profile_permissions rename to role_permissions;
alter table if exists public.user_permission_profiles rename to membership_roles;

-- 2) Rename columns to match new names
-- role_permissions already has role_id in Phase 1/2 path? If not, add; if yes, drop legacy profile_id.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'role_permissions'
      and column_name = 'profile_id'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'role_permissions'
        and column_name = 'role_id'
    ) then
      alter table public.role_permissions rename column profile_id to role_id;
    else
      alter table public.role_permissions drop column profile_id;
    end if;
  end if;
end$$;

-- membership_roles: Phase 2 added role_id; drop legacy profile_id if still present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'membership_roles'
      and column_name = 'profile_id'
  ) then
    alter table public.membership_roles drop column profile_id;
  end if;
end$$;

-- 3) Recreate primary key on membership_roles using role_id
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'user_permission_profiles_pkey') then
    alter table public.membership_roles drop constraint user_permission_profiles_pkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'membership_roles_pkey') then
    alter table public.membership_roles drop constraint membership_roles_pkey;
  end if;
  alter table public.membership_roles add constraint membership_roles_pkey primary key (user_id, org_id, role_id);
end$$;

-- 4) Refresh supporting indexes (no-op if they already exist)
create index if not exists membership_roles_user_idx on public.membership_roles(user_id);
create index if not exists membership_roles_org_idx on public.membership_roles(org_id);
create index if not exists membership_roles_role_idx on public.membership_roles(role_id);
create index if not exists role_permissions_role_idx on public.role_permissions(role_id);
create index if not exists role_permissions_permission_idx on public.role_permissions(permission_id);

-- 5) Compatibility views to keep legacy names working during rollout
create or replace view public.permission_profiles as
  select
    id,
    org_id,
    name,
    description,
    is_system,
    created_at,
    updated_at
  from public.roles;

create or replace view public.permission_profile_permissions as
  select
    role_id as profile_id,
    permission_id,
    permission,
    created_at,
    updated_at
  from public.role_permissions;

create or replace view public.user_permission_profiles as
  select
    user_id,
    org_id,
    role_id as profile_id,
    role_id,
    created_at,
    updated_at
  from public.membership_roles;

commit;
