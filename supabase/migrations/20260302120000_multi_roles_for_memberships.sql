-- Support multiple roles per user/org while keeping org_memberships as the primary (highest) role
create table if not exists public.org_membership_roles (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists org_membership_roles_user_org_role_idx on public.org_membership_roles(user_id, org_id, role);
create index if not exists org_membership_roles_org_idx on public.org_membership_roles(org_id);
create index if not exists org_membership_roles_user_idx on public.org_membership_roles(user_id);

alter table public.org_membership_roles enable row level security;

-- Allow users to read their own roles (service role bypasses RLS for admin APIs)
create policy membership_roles_self_read on public.org_membership_roles
  for select using (auth.uid() = user_id);

-- Keep updated_at in sync
create trigger set_org_membership_roles_updated_at
  before update on public.org_membership_roles
  for each row
  execute function public.set_org_memberships_updated_at();
