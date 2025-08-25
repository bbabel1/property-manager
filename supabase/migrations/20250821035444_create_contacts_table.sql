-- Create contacts table as single source of truth for person/company identity
-- Migration: 20250821035443_create_contacts_table.sql

-- 1) Base table (create if not exists)
create table if not exists public.contacts (
  id bigserial primary key,
  is_company boolean not null default false,
  first_name text,
  last_name text,
  company_name text,
  primary_email text,
  alt_email text,
  primary_phone text,
  alt_phone text,
  date_of_birth date,
  primary_address_line_1 text,
  primary_address_line_2 text,
  primary_address_line_3 text,
  primary_city text,
  primary_state text,
  primary_postal_code text,
  primary_country text default 'USA',
  alt_address_line_1 text,
  alt_address_line_2 text,
  alt_address_line_3 text,
  alt_city text,
  alt_state text,
  alt_postal_code text,
  alt_country text,
  mailing_preference text,
  tax_payer_id text,
  tax_payer_type text,
  tax_payer_name text,
  tax_address_line_1 text,
  tax_address_line_2 text,
  tax_address_line_3 text,
  tax_city text,
  tax_state text,
  tax_postal_code text,
  tax_country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Ensure all columns exist (idempotent add-if-missing)
do $$
declare
  spec_cols text[] := array[
    'is_company','first_name','last_name','company_name',
    'primary_email','alt_email','primary_phone','alt_phone','date_of_birth',
    'primary_address_line_1','primary_address_line_2','primary_address_line_3',
    'primary_city','primary_state','primary_postal_code','primary_country',
    'alt_address_line_1','alt_address_line_2','alt_address_line_3',
    'alt_city','alt_state','alt_postal_code','alt_country',
    'mailing_preference',
    'tax_payer_id','tax_payer_type','tax_payer_name',
    'tax_address_line_1','tax_address_line_2','tax_address_line_3',
    'tax_city','tax_state','tax_postal_code','tax_country'
  ];
  col text;
begin
  -- Add any missing columns with correct types/defaults
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='contacts'
                   and column_name='is_company') then
    alter table public.contacts add column is_company boolean not null default false;
  end if;

  -- Helper adds (text columns default null)
  foreach col in array spec_cols loop
    if not exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name='contacts'
                     and column_name = col) then
      execute format('alter table public.contacts add column %I text', col);
    end if;
  end loop;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='contacts'
                   and column_name='date_of_birth') then
    alter table public.contacts add column date_of_birth date;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='contacts'
                   and column_name='created_at') then
    alter table public.contacts add column created_at timestamptz not null default now();
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='contacts'
                   and column_name='updated_at') then
    alter table public.contacts add column updated_at timestamptz not null default now();
  end if;
end$$;

-- 3) Case-insensitive unique index on primary_email (only when present)
create unique index if not exists uq_contacts_primary_email_lower
on public.contacts (lower(primary_email))
where primary_email is not null;

-- 4) Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();
