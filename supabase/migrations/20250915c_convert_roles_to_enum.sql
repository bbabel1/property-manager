-- Convert staff.role and property_staff.role to unified enum public.staff_role
set check_function_bodies = off;

-- 1) Drop defaults and convert to text to avoid enum name mismatches
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff' and column_name='role') then
    begin
      alter table public.staff alter column role drop default;
    exception when others then null; end;
    alter table public.staff alter column role type text using role::text;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='property_staff' and column_name='role') then
    begin
      alter table public.property_staff alter column role drop default;
    exception when others then null; end;
    alter table public.property_staff alter column role type text using role::text;
  end if;
end $$;

-- 2) Create the unified enum if missing
do $$
begin
  if not exists (select 1 from pg_type where typname = 'staff_role') then
    create type public.staff_role as enum (
      'PROPERTY_MANAGER',
      'ASSISTANT_PROPERTY_MANAGER',
      'MAINTENANCE_COORDINATOR',
      'ACCOUNTANT',
      'ADMINISTRATOR'
    );
  end if;
end $$;

-- 3) Normalize any stray values to PROPERTY_MANAGER prior to cast
update public.staff set role = 'PROPERTY_MANAGER' where role is null or trim(role) = '';
update public.staff set role = 'PROPERTY_MANAGER' where upper(role) not in (
  'PROPERTY_MANAGER','ASSISTANT_PROPERTY_MANAGER','MAINTENANCE_COORDINATOR','ACCOUNTANT','ADMINISTRATOR'
);
update public.property_staff set role = 'PROPERTY_MANAGER' where role is null or trim(role) = '';
update public.property_staff set role = 'PROPERTY_MANAGER' where upper(role) not in (
  'PROPERTY_MANAGER','ASSISTANT_PROPERTY_MANAGER','MAINTENANCE_COORDINATOR','ACCOUNTANT','ADMINISTRATOR'
);

-- 4) Cast text -> enum and restore defaults
alter table public.staff alter column role type public.staff_role using upper(role)::public.staff_role;
alter table public.property_staff alter column role type public.staff_role using upper(role)::public.staff_role;
alter table public.staff alter column role set default 'PROPERTY_MANAGER';
alter table public.property_staff alter column role set default 'PROPERTY_MANAGER';

-- 5) Ensure index on property_staff for efficient lookups
create index if not exists property_staff_property_id_staff_id_role_idx on public.property_staff(property_id, staff_id, role);

