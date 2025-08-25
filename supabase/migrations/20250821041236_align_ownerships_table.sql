-- Align ownerships table as join table between properties and owners
-- Migration: 20250821041236_align_ownerships_table.sql

-- 1) Create table if not exists
create table if not exists public.ownerships (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete restrict,
  "primary" boolean not null default false,
  ownership_percentage numeric(5,2) not null check (ownership_percentage >= 0 and ownership_percentage <= 100),
  disbursement_percentage numeric(5,2) not null check (disbursement_percentage >= 0 and disbursement_percentage <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, owner_id)
);

-- 2) Ensure all required columns exist (idempotent adds)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='ownerships' and column_name='property_id'
  ) then
    alter table public.ownerships add column property_id uuid;
    alter table public.ownerships add constraint ownerships_property_fk
      foreign key (property_id) references public.properties(id) on delete cascade;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='ownerships' and column_name='owner_id'
  ) then
    alter table public.ownerships add column owner_id uuid;
    alter table public.ownerships add constraint ownerships_owner_fk
      foreign key (owner_id) references public.owners(id) on delete restrict;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='ownerships'
      and constraint_type='UNIQUE'
  ) then
    alter table public.ownerships add constraint uq_property_owner unique (property_id, owner_id);
  end if;

  -- Add missing numeric fields with checks
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='ownerships' and column_name='ownership_percentage') then
    alter table public.ownerships add column ownership_percentage numeric(5,2) not null default 0
      check (ownership_percentage >= 0 and ownership_percentage <= 100);
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='ownerships' and column_name='disbursement_percentage') then
    alter table public.ownerships add column disbursement_percentage numeric(5,2) not null default 0
      check (disbursement_percentage >= 0 and disbursement_percentage <= 100);
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='ownerships' and column_name='primary') then
    alter table public.ownerships add column "primary" boolean not null default false;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='ownerships' and column_name='created_at') then
    alter table public.ownerships add column created_at timestamptz not null default now();
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='ownerships' and column_name='updated_at') then
    alter table public.ownerships add column updated_at timestamptz not null default now();
  end if;
end$$;

-- 3) Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin 
  new.updated_at := now(); 
  return new; 
end$$;

drop trigger if exists trg_ownerships_updated_at on public.ownerships;
create trigger trg_ownerships_updated_at
before update on public.ownerships
for each row execute function public.set_updated_at();

-- 4) Report unexpected columns
create or replace view public._ownerships_unexpected_columns as
select column_name
from information_schema.columns
where table_schema='public' and table_name='ownerships'
  and column_name not in (
    'id','property_id','owner_id','primary',
    'ownership_percentage','disbursement_percentage',
    'created_at','updated_at'
  )
order by column_name;

-- 5) Verification queries (commented out - run manually if needed)
-- Check if ownerships table has the correct structure:
-- select column_name, data_type, is_nullable, column_default 
-- from information_schema.columns 
-- where table_schema='public' and table_name='ownerships' 
-- order by ordinal_position;

-- Check for unexpected columns:
-- select * from public._ownerships_unexpected_columns;

-- Check foreign key constraints:
-- select 
--   tc.constraint_name, 
--   tc.table_name, 
--   kcu.column_name, 
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name 
-- from information_schema.table_constraints AS tc 
-- join information_schema.key_column_usage AS kcu
--   on tc.constraint_name = kcu.constraint_name
--   and tc.table_schema = kcu.table_schema
-- join information_schema.constraint_column_usage AS ccu
--   on ccu.constraint_name = tc.constraint_name
--   and ccu.table_schema = tc.table_schema
-- where tc.constraint_type = 'FOREIGN KEY' 
--   and tc.table_name = 'ownerships';

-- Check unique constraint:
-- select 
--   constraint_name,
--   constraint_type
-- from information_schema.table_constraints 
-- where table_schema = 'public' 
-- and table_name = 'ownerships' 
-- and constraint_type = 'UNIQUE';
