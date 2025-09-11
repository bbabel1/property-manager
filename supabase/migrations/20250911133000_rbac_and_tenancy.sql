-- RBAC roles enum
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum (
      'platform_admin',
      'org_admin',
      'org_manager',
      'org_staff',
      'owner_portal',
      'tenant_portal'
    );
  end if;
end $$;

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Profiles (mirror of auth.users minimal fields)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  created_at timestamptz not null default now()
);

-- Org memberships
create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role app_role not null default 'org_staff',
  unique (user_id, org_id)
);

-- Add org_id to key domain tables (non-destructive; nullable for backfill)
alter table public.properties add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.units add column if not exists org_id uuid references public.organizations(id) on delete restrict;
-- Add an index for scoping
create index if not exists idx_properties_org on public.properties(org_id);
create index if not exists idx_units_org on public.units(org_id);

-- Helper view: current user's orgs
create or replace view public.v_user_orgs as
select m.user_id, m.org_id, m.role from public.org_memberships m;

-- Enable RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.org_memberships enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;

-- Profiles: self access
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "update own profile" on public.profiles for update using (auth.uid() = user_id);

-- Org memberships: only see own rows
drop policy if exists "select my memberships" on public.org_memberships;
create policy "select my memberships" on public.org_memberships for select using (auth.uid() = user_id);

-- Tighten properties/unit policies: drop permissive defaults from initial schema
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='properties' and policyname='Enable read access for all users') then
    drop policy "Enable read access for all users" on public.properties;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='properties' and policyname='Enable insert access for authenticated users') then
    drop policy "Enable insert access for authenticated users" on public.properties;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='properties' and policyname='Enable update access for authenticated users') then
    drop policy "Enable update access for authenticated users" on public.properties;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='properties' and policyname='Enable delete access for authenticated users') then
    drop policy "Enable delete access for authenticated users" on public.properties;
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='units' and policyname='Enable read access for all users') then
    drop policy "Enable read access for all users" on public.units;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='units' and policyname='Enable insert access for authenticated users') then
    drop policy "Enable insert access for authenticated users" on public.units;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='units' and policyname='Enable update access for authenticated users') then
    drop policy "Enable update access for authenticated users" on public.units;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='units' and policyname='Enable delete access for authenticated users') then
    drop policy "Enable delete access for authenticated users" on public.units;
  end if;
end $$;

-- Properties tenant isolation
drop policy if exists "properties_tenant_isolation" on public.properties;
create policy "properties_tenant_isolation" on public.properties
for all using (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid()
      and m.org_id = properties.org_id
  )
);

-- Elevated writes within org (admin/manager/platform_admin)
drop policy if exists "properties_org_admin_write" on public.properties;
create policy "properties_org_admin_write" on public.properties
for insert with check (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid()
      and m.org_id = properties.org_id
      and m.role in ('org_admin','org_manager','platform_admin')
  )
);

drop policy if exists "properties_org_admin_update" on public.properties;
create policy "properties_org_admin_update" on public.properties
for update using (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid()
      and m.org_id = properties.org_id
      and m.role in ('org_admin','org_manager','platform_admin')
  )
);

-- Units: mirror the same pattern
drop policy if exists "units_tenant_isolation" on public.units;
create policy "units_tenant_isolation" on public.units
for all using (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid()
      and m.org_id = units.org_id
  )
);

drop policy if exists "units_org_admin_write" on public.units;
create policy "units_org_admin_write" on public.units
for insert with check (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid()
      and m.org_id = units.org_id
      and m.role in ('org_admin','org_manager','platform_admin')
  )
);

drop policy if exists "units_org_admin_update" on public.units;
create policy "units_org_admin_update" on public.units
for update using (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid()
      and m.org_id = units.org_id
      and m.role in ('org_admin','org_manager','platform_admin')
  )
);

