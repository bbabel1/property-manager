-- Align owners table as 1:1 profile for contacts
-- Migration: 20250821040753_align_owners_table.sql

-- 1) Create or align owners table with UUID PK
create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  contact_id bigint not null unique references public.contacts(id) on delete cascade,
  management_agreement_start_date date,
  management_agreement_end_date date,
  comment text,
  etf_account_type text,
  etf_account_number text,
  etf_routing_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Ensure all required columns exist (idempotent add-if-missing)
do $$
begin
  -- Ensure contact_id exists and is unique
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='owners' and column_name='contact_id'
  ) then
    alter table public.owners add column contact_id bigint;
    alter table public.owners add constraint owners_contact_fk
      foreign key (contact_id) references public.contacts(id) on delete cascade;
    create unique index if not exists uq_owners_contact_id on public.owners(contact_id);
  end if;

  -- Add missing profile fields
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='owners' and column_name='management_agreement_start_date') then
    alter table public.owners add column management_agreement_start_date date;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='owners' and column_name='management_agreement_end_date') then
    alter table public.owners add column management_agreement_end_date date;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='owners' and column_name='comment') then
    alter table public.owners add column comment text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='owners' and column_name='etf_account_type') then
    alter table public.owners add column etf_account_type text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='owners' and column_name='etf_account_number') then
    alter table public.owners add column etf_account_number text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='owners' and column_name='etf_routing_number') then
    alter table public.owners add column etf_routing_number text;
  end if;

  -- timestamps if missing
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='owners' and column_name='created_at') then
    alter table public.owners add column created_at timestamptz not null default now();
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='owners' and column_name='updated_at') then
    alter table public.owners add column updated_at timestamptz not null default now();
  end if;
end$$;

-- 3) Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin 
  new.updated_at := now(); 
  return new; 
end$$;

drop trigger if exists trg_owners_updated_at on public.owners;
create trigger trg_owners_updated_at
before update on public.owners
for each row execute function public.set_updated_at();

-- 4) Report unexpected columns
create or replace view public._owners_unexpected_columns as
select column_name
from information_schema.columns
where table_schema='public' and table_name='owners'
  and column_name not in (
    'id','contact_id',
    'management_agreement_start_date','management_agreement_end_date','comment',
    'etf_account_type','etf_account_number','etf_routing_number',
    'created_at','updated_at'
  )
order by column_name;

-- 5) Verification queries (commented out - run manually if needed)
-- Check if owners table has the correct structure:
-- select column_name, data_type, is_nullable, column_default 
-- from information_schema.columns 
-- where table_schema='public' and table_name='owners' 
-- order by ordinal_position;

-- Check for unexpected columns:
-- select * from public._owners_unexpected_columns;

-- Check foreign key constraint:
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
--   and tc.table_name='owners';
