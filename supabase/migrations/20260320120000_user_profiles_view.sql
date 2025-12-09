-- User profiles backed by contacts + profiles table; no new tables are introduced.
-- Adds missing preference columns to public.profiles, hydrates from auth.user_metadata,
-- guarantees each auth user has a contact row, and exposes a unified user_profiles view.

-- 1) Add profile preference columns (idempotent)
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists phone text,
  add column if not exists timezone text,
  add column if not exists locale text,
  add column if not exists date_format text,
  add column if not exists currency text,
  add column if not exists number_format text,
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb,
  add column if not exists personal_integrations jsonb not null default '{}'::jsonb,
  add column if not exists favorite_properties text[] not null default '{}'::text[],
  add column if not exists landing_page text,
  add column if not exists avatar_url text,
  add column if not exists two_factor_enabled boolean not null default false,
  add column if not exists primary_work_role text,
  add column if not exists updated_at timestamptz not null default now();

-- Keep updated_at fresh
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- 2) Tighten RLS for profiles (self only)
alter table public.profiles enable row level security;
drop policy if exists "profiles_self_all" on public.profiles;
create policy "profiles_self_all" on public.profiles
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) Ensure every auth user has a contact row (lightweight seed; safe to re-run)
insert into public.contacts (user_id, first_name, last_name, primary_email, display_name, primary_phone)
select
  u.id,
  nullif(u.raw_user_meta_data->>'first_name', '') as first_name,
  nullif(u.raw_user_meta_data->>'last_name', '') as last_name,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data->>'display_name', ''),
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    concat_ws(' ', nullif(u.raw_user_meta_data->>'first_name', ''), nullif(u.raw_user_meta_data->>'last_name', '')),
    u.email
  ) as display_name,
  coalesce(nullif(u.raw_user_meta_data->>'phone', ''), nullif(u.raw_user_meta_data->>'mobile', ''), u.phone) as primary_phone
from auth.users u
left join public.contacts c on c.user_id = u.id
where c.id is null;

-- 4) Hydrate profiles from auth.user_metadata (idempotent merge)
with meta as (
  select
    u.id as user_id,
    u.email,
    u.raw_user_meta_data as meta
  from auth.users u
),
parsed as (
  select
    user_id,
    email,
    nullif(meta->>'full_name', '') as full_name,
    nullif(meta->>'name', '') as name_fallback,
    concat_ws(' ', nullif(meta->>'first_name', ''), nullif(meta->>'last_name', '')) as name_parts,
    nullif(meta->>'display_name', '') as display_name,
    coalesce(nullif(meta->>'phone', ''), nullif(meta->>'mobile', '')) as phone,
    nullif(meta->>'timezone', '') as timezone,
    nullif(meta->>'locale', '') as locale,
    nullif(meta->>'date_format', '') as date_format,
    nullif(meta->>'currency', '') as currency,
    nullif(meta->>'number_format', '') as number_format,
    meta->'notification_preferences' as notification_preferences,
    meta->'personal_integrations' as personal_integrations,
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(meta->'favorite_properties') as t(value)),
      '{}'::text[]
    ) as favorite_properties,
    nullif(meta->>'landing_page', '') as landing_page,
    nullif(meta->>'avatar_url', '') as avatar_url,
    nullif(meta->>'primary_work_role', '') as primary_work_role,
    (meta->>'two_factor_enabled')::boolean as two_factor_enabled
  from meta
)
insert into public.profiles (
  user_id,
  full_name,
  email,
  display_name,
  phone,
  timezone,
  locale,
  date_format,
  currency,
  number_format,
  notification_preferences,
  personal_integrations,
  favorite_properties,
  landing_page,
  avatar_url,
  two_factor_enabled,
  primary_work_role,
  updated_at
)
select
  p.user_id,
  coalesce(p.full_name, p.name_fallback, nullif(p.name_parts, ''), prof.full_name, p.email) as full_name,
  coalesce(p.email, prof.email) as email,
  coalesce(p.display_name, prof.display_name) as display_name,
  coalesce(p.phone, prof.phone) as phone,
  coalesce(p.timezone, prof.timezone) as timezone,
  coalesce(p.locale, prof.locale) as locale,
  coalesce(p.date_format, prof.date_format) as date_format,
  coalesce(p.currency, prof.currency) as currency,
  coalesce(p.number_format, prof.number_format) as number_format,
  coalesce(p.notification_preferences::jsonb, prof.notification_preferences, '{}'::jsonb) as notification_preferences,
  coalesce(p.personal_integrations::jsonb, prof.personal_integrations, '{}'::jsonb) as personal_integrations,
  coalesce(p.favorite_properties, prof.favorite_properties, '{}'::text[]) as favorite_properties,
  coalesce(p.landing_page, prof.landing_page) as landing_page,
  coalesce(p.avatar_url, prof.avatar_url) as avatar_url,
  coalesce(p.two_factor_enabled, prof.two_factor_enabled, false) as two_factor_enabled,
  coalesce(p.primary_work_role, prof.primary_work_role) as primary_work_role,
  now()
from parsed p
left join public.profiles prof on prof.user_id = p.user_id
on conflict (user_id) do update
set full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = coalesce(excluded.email, public.profiles.email),
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    timezone = coalesce(excluded.timezone, public.profiles.timezone),
    locale = coalesce(excluded.locale, public.profiles.locale),
    date_format = coalesce(excluded.date_format, public.profiles.date_format),
    currency = coalesce(excluded.currency, public.profiles.currency),
    number_format = coalesce(excluded.number_format, public.profiles.number_format),
    notification_preferences = coalesce(excluded.notification_preferences, public.profiles.notification_preferences),
    personal_integrations = coalesce(excluded.personal_integrations, public.profiles.personal_integrations),
    favorite_properties = coalesce(excluded.favorite_properties, public.profiles.favorite_properties),
    landing_page = coalesce(excluded.landing_page, public.profiles.landing_page),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    two_factor_enabled = coalesce(excluded.two_factor_enabled, public.profiles.two_factor_enabled),
    primary_work_role = coalesce(excluded.primary_work_role, public.profiles.primary_work_role),
    updated_at = now();

-- 5) User-facing view combining contacts + profiles
create or replace view public.user_profiles as
select
  prof.user_id,
  c.id as contact_id,
  c.first_name,
  c.last_name,
  coalesce(prof.full_name, concat_ws(' ', c.first_name, c.last_name), c.display_name) as full_name,
  coalesce(prof.display_name, c.display_name) as display_name,
  coalesce(prof.phone, c.primary_phone) as phone,
  prof.timezone,
  prof.locale,
  prof.date_format,
  prof.currency,
  prof.number_format,
  prof.notification_preferences,
  prof.personal_integrations,
  prof.favorite_properties,
  prof.landing_page,
  prof.avatar_url,
  prof.two_factor_enabled,
  prof.primary_work_role,
  prof.updated_at,
  prof.email,
  c.primary_email as contact_email,
  c.primary_phone as contact_phone
from public.profiles prof
left join public.contacts c on c.user_id = prof.user_id;

comment on view public.user_profiles is 'Unified user profile view combining contacts + profile preferences';
grant select on public.user_profiles to anon, authenticated, service_role;
