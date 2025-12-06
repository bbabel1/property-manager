-- Permission profiles to manage fine-grained permissions per org/user

BEGIN;

create table if not exists public.permission_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permission_profiles_org_name_unique unique (org_id, name)
);

create table if not exists public.permission_profile_permissions (
  profile_id uuid references public.permission_profiles(id) on delete cascade,
  permission text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, permission)
);

create table if not exists public.user_permission_profiles (
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  profile_id uuid references public.permission_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, org_id, profile_id)
);

create index if not exists user_permission_profiles_user_idx on public.user_permission_profiles(user_id);
create index if not exists user_permission_profiles_org_idx on public.user_permission_profiles(org_id);
create index if not exists permission_profile_permissions_profile_idx on public.permission_profile_permissions(profile_id);

-- Seed a handful of system profiles (org-agnostic) for bootstrap
insert into public.permission_profiles (name, description, is_system)
values
  ('Staff - Manager', 'Full staff access (manager)', true),
  ('Staff - Standard', 'Read/edit without approvals', true),
  ('Owner Portal', 'Owner portal default', true),
  ('Tenant Portal', 'Tenant portal default', true),
  ('Vendor Portal', 'Vendor portal default', true)
on conflict (org_id, name) do nothing;

-- Helper to insert permissions for a profile name
do $$ declare
  prof record;
begin
  for prof in
    select id, name from public.permission_profiles
    where name in ('Staff - Manager','Staff - Standard','Owner Portal','Tenant Portal','Vendor Portal')
  loop
    if prof.name = 'Staff - Manager' then
      insert into public.permission_profile_permissions(profile_id, permission)
      values
        (prof.id, 'properties.read'),
        (prof.id, 'properties.write'),
        (prof.id, 'owners.read'),
        (prof.id, 'owners.write'),
        (prof.id, 'leases.read'),
        (prof.id, 'leases.write'),
        (prof.id, 'monthly_logs.read'),
        (prof.id, 'monthly_logs.write'),
        (prof.id, 'monthly_logs.approve'),
        (prof.id, 'monthly_logs.send_statement')
      on conflict do nothing;
    elsif prof.name = 'Staff - Standard' then
      insert into public.permission_profile_permissions(profile_id, permission)
      values
        (prof.id, 'properties.read'),
        (prof.id, 'owners.read'),
        (prof.id, 'leases.read'),
        (prof.id, 'monthly_logs.read'),
        (prof.id, 'monthly_logs.write')
      on conflict do nothing;
    elsif prof.name = 'Owner Portal' then
      insert into public.permission_profile_permissions(profile_id, permission)
      values
        (prof.id, 'properties.read'),
        (prof.id, 'leases.read'),
        (prof.id, 'monthly_logs.read')
      on conflict do nothing;
    elsif prof.name = 'Tenant Portal' then
      insert into public.permission_profile_permissions(profile_id, permission)
      values
        (prof.id, 'leases.read')
      on conflict do nothing;
    elsif prof.name = 'Vendor Portal' then
      insert into public.permission_profile_permissions(profile_id, permission)
      values
        (prof.id, 'properties.read')
      on conflict do nothing;
    end if;
  end loop;
end $$;

COMMIT;
