-- Phase 1: RBAC schema prep (non-breaking)
-- - Add canonical permissions table
-- - Add FK-based permission mapping while keeping legacy text column
-- - Add dual-write role_id on user_permission_profiles for smooth rename

begin;

-- Create permissions catalog (system-level or org-scoped extensions)
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  key text not null,
  description text,
  category text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permissions_org_key_unique unique (org_id, key),
  constraint permissions_system_key_unique unique (key) deferrable initially immediate
    -- deferrable to allow reorder during backfill when org_id is null (system)
);

-- Add permission_id alongside legacy text column; keep PK as-is for now
alter table if exists public.permission_profile_permissions
  add column if not exists permission_id uuid references public.permissions(id);

create index if not exists permission_profile_permissions_permission_idx
  on public.permission_profile_permissions(permission_id);

-- Prepare for role rename by dual-writing a role_id that mirrors profile_id
alter table if exists public.user_permission_profiles
  add column if not exists role_id uuid references public.permission_profiles(id) on delete cascade;

create index if not exists user_permission_profiles_role_idx
  on public.user_permission_profiles(role_id);

commit;
