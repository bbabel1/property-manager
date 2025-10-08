-- Users, profiles, contacts alignment and admin-friendly view
-- This migration is idempotent and safe to run multiple times.
-- 1) Add user_id to public.contacts (one contact per auth user)
alter table public.contacts
add column if not exists user_id uuid references auth.users(id) on delete
set null;
-- Helpful index + uniqueness (allow nulls)
create unique index if not exists uq_contacts_user_id on public.contacts(user_id)
where user_id is not null;
-- 2) Ensure public.profiles exists and mirrors auth.users minimally
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  created_at timestamptz not null default now()
);
-- 3) Auto-insert profile on new auth user
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$ begin
insert into public.profiles(user_id, email)
values (new.id, new.email) on conflict (user_id) do
update
set email = excluded.email;
return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after
insert on auth.users for each row execute function public.handle_new_user();
-- 4) View to join auth user info with app profile + memberships
create or replace view public.users_with_auth as
select u.id as user_id,
  coalesce(
    p.full_name,
    (u.raw_user_meta_data->>'full_name')
  ) as full_name,
  coalesce(p.email, u.email) as email,
  u.phone as phone,
  u.created_at as created_at,
  u.last_sign_in_at as last_sign_in_at,
  (
    select coalesce(jsonb_agg(distinct i.provider), '[]'::jsonb)
    from auth.identities i
    where i.user_id = u.id
  ) as providers,
  (
    select coalesce(
        jsonb_agg(
          jsonb_build_object('org_id', m.org_id, 'role', m.role)
        ),
        '[]'::jsonb
      )
    from public.org_memberships m
    where m.user_id = u.id
  ) as memberships
from auth.users u
  left join public.profiles p on p.user_id = u.id;
comment on view public.users_with_auth is 'Admin-oriented view that surfaces auth.users with app profile and org memberships';
-- 5) Convenience helper to check for platform admin privilege
create or replace function public.is_platform_admin(p_user_id uuid default auth.uid()) returns boolean language sql stable as $$
select exists (
    select 1
    from public.org_memberships m
    where m.user_id = coalesce(p_user_id, auth.uid())
      and m.role = 'platform_admin'
  );
$$;