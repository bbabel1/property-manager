-- Phase 1: Extend staff model, unify roles, index joins
set check_function_bodies = off;
-- 1) Staff role enum used by staff.role and property_staff.role
-- Note: staff_roles enum already exists from migration 060, extend it if needed
do $$ begin -- Check if we need to add more values to the existing staff_roles enum
if exists (
  select 1
  from pg_type
  where typname = 'staff_roles'
) then -- Add missing enum values if they don't exist
if not exists (
  select 1
  from pg_enum e
    join pg_type t on e.enumtypid = t.oid
  where t.typname = 'staff_roles'
    and e.enumlabel = 'Assistant Property Manager'
) then alter type public.staff_roles
add value 'Assistant Property Manager';
end if;
if not exists (
  select 1
  from pg_enum e
    join pg_type t on e.enumtypid = t.oid
  where t.typname = 'staff_roles'
    and e.enumlabel = 'Maintenance Coordinator'
) then alter type public.staff_roles
add value 'Maintenance Coordinator';
end if;
if not exists (
  select 1
  from pg_enum e
    join pg_type t on e.enumtypid = t.oid
  where t.typname = 'staff_roles'
    and e.enumlabel = 'Accountant'
) then alter type public.staff_roles
add value 'Accountant';
end if;
if not exists (
  select 1
  from pg_enum e
    join pg_type t on e.enumtypid = t.oid
  where t.typname = 'staff_roles'
    and e.enumlabel = 'Administrator'
) then alter type public.staff_roles
add value 'Administrator';
end if;
else -- Create the enum if it doesn't exist (shouldn't happen after migration 060)
create type public.staff_roles as enum (
  'Property Manager',
  'Assistant Property Manager',
  'Maintenance Coordinator',
  'Accountant',
  'Administrator',
  'Bookkeeper'
);
end if;
end $$;
-- 2) Extend staff table with profile fields and links
do $$ begin if not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'staff'
    and column_name = 'user_id'
) then
alter table public.staff
add column user_id uuid null references auth.users(id);
end if;
if not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'staff'
    and column_name = 'first_name'
) then
alter table public.staff
add column first_name text;
end if;
if not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'staff'
    and column_name = 'last_name'
) then
alter table public.staff
add column last_name text;
end if;
if not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'staff'
    and column_name = 'email'
) then
alter table public.staff
add column email text;
end if;
if not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'staff'
    and column_name = 'phone'
) then
alter table public.staff
add column phone text;
end if;
if not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'staff'
    and column_name = 'title'
) then
alter table public.staff
add column title text;
end if;
if not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'staff'
    and column_name = 'buildium_staff_id'
) then
alter table public.staff
add column buildium_staff_id integer;
end if;
if not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'staff'
    and column_name = 'created_at'
) then
alter table public.staff
add column created_at timestamptz default now() not null;
end if;
if not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'staff'
    and column_name = 'updated_at'
) then
alter table public.staff
add column updated_at timestamptz default now() not null;
end if;
end $$;
-- 3) Staff.role should already be using staff_roles enum from migration 060
-- Just ensure defaults and constraints are proper
do $$ begin if exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'staff'
    and column_name = 'role'
) then -- Ensure default is set
begin
alter table public.staff
alter column role
set default 'Property Manager';
exception
when others then null;
end;
-- Ensure not null constraint
begin
alter table public.staff
alter column role
set not null;
exception
when others then null;
end;
end if;
end $$;
-- 4) Convert property_staff.role to enum and index joins
do $$ begin if exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'property_staff'
    and column_name = 'role'
) then
update public.property_staff
set role = 'Property Manager'
where role is null;
-- Ensure all text values map to enum or cast will fail
update public.property_staff
set role = 'Property Manager'
where role not in (
    'Property Manager',
    'Assistant Property Manager',
    'Maintenance Coordinator',
    'Accountant',
    'Administrator',
    'Bookkeeper'
  );
begin
alter table public.property_staff
alter column role drop default;
exception
when others then null;
end;
alter table public.property_staff
alter column role type public.staff_roles using role::public.staff_roles;
begin
alter table public.property_staff
alter column role
set default 'Property Manager';
exception
when others then null;
end;
end if;
end $$;
-- 5) Indexes & constraints
create unique index if not exists staff_buildium_staff_id_key on public.staff(buildium_staff_id)
where buildium_staff_id is not null;
create index if not exists staff_user_id_idx on public.staff(user_id);
create unique index if not exists staff_email_key on public.staff(lower(email))
where email is not null;
create index if not exists property_staff_property_id_staff_id_role_idx on public.property_staff(property_id, staff_id, role);
-- 6) Updated-at trigger, if helper exists
do $$ begin if exists (
  select 1
  from pg_proc
  where proname = 'set_updated_at'
) then drop trigger if exists trg_staff_updated_at on public.staff;
create trigger trg_staff_updated_at before
update on public.staff for each row execute function public.set_updated_at();
end if;
end $$;