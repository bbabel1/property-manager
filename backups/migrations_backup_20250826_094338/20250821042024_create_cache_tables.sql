-- Create denormalized cache tables for fast reads with real-time triggers
-- Migration: 20250821042024_create_cache_tables.sql
-- Prereqs: contacts(id uuid), owners(id uuid, contact_id uuid), properties(id uuid), ownerships(id uuid, property_id uuid, owner_id uuid)

-- ---------- Utility: updated_at trigger (idempotent) ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin 
  new.updated_at := now(); 
  return new; 
end$$;

-- ==============================================================
-- A) OWNERS LIST CACHE  (one row per owner)
-- ==============================================================
create table if not exists public.owners_list_cache (
  owner_id      uuid primary key,     -- mirrors owners.id
  contact_id    bigint not null,      -- mirrors contacts.id (bigserial)
  display_name  text,                 -- "First Last" or company
  primary_email text,
  primary_phone text,
  management_agreement_start_date date,
  management_agreement_end_date   date,
  updated_at timestamptz not null default now()
);

create index if not exists idx_olc_email_lower on public.owners_list_cache (lower(primary_email));
create index if not exists idx_olc_display_name on public.owners_list_cache (display_name);

-- Upsert helper: recompute one owner row
create or replace function public.upsert_owners_list_cache(p_owner_id uuid)
returns void language sql as $$
insert into public.owners_list_cache as t (
  owner_id, contact_id, display_name, primary_email, primary_phone,
  management_agreement_start_date, management_agreement_end_date, updated_at
)
select
  o.id,
  c.id,
  coalesce(nullif(trim(c.first_name||' '||c.last_name),''), c.company_name) as display_name,
  c.primary_email,
  c.primary_phone,
  o.management_agreement_start_date,
  o.management_agreement_end_date,
  now()
from public.owners o
join public.contacts c on c.id = o.contact_id
where o.id = p_owner_id
on conflict (owner_id) do update
  set contact_id  = excluded.contact_id,
      display_name= excluded.display_name,
      primary_email=excluded.primary_email,
      primary_phone=excluded.primary_phone,
      management_agreement_start_date = excluded.management_agreement_start_date,
      management_agreement_end_date   = excluded.management_agreement_end_date,
      updated_at = now();
$$;

-- Triggers: owners changes → cache
create or replace function public.trg_owners_to_cache() returns trigger language plpgsql as $$
begin
  perform public.upsert_owners_list_cache(coalesce(new.id, old.id));
  return new;
end$$;

drop trigger if exists owners_to_cache on public.owners;
create trigger owners_to_cache
after insert or update on public.owners
for each row execute function public.trg_owners_to_cache();

-- Triggers: contacts identity changes → cache (for linked owners)
create or replace function public.trg_contacts_to_olc() returns trigger language plpgsql as $$
begin
  perform public.upsert_owners_list_cache(o.id)
  from public.owners o
  where o.contact_id = new.id;
  return new;
end$$;

drop trigger if exists contacts_to_olc on public.contacts;
create trigger contacts_to_olc
after update of first_name,last_name,company_name,primary_email,primary_phone on public.contacts
for each row execute function public.trg_contacts_to_olc();

-- Optional: keep updated_at fresh on cache updates (not required but nice)
drop trigger if exists trg_olc_updated_at on public.owners_list_cache;
create trigger trg_olc_updated_at
before update on public.owners_list_cache
for each row execute function public.set_updated_at();

-- One-time backfill
do $$
begin
  insert into public.owners_list_cache (owner_id, contact_id, display_name, primary_email, primary_phone,
                                        management_agreement_start_date, management_agreement_end_date)
  select
    o.id, c.id,
    coalesce(nullif(trim(c.first_name||' '||c.last_name),''), c.company_name),
    c.primary_email, c.primary_phone,
    o.management_agreement_start_date, o.management_agreement_end_date
  from public.owners o
  join public.contacts c on c.id = o.contact_id
  on conflict (owner_id) do nothing;
end$$;

-- ==============================================================
-- B) PROPERTY → OWNERS CACHE  (one row per ownership link)
-- ==============================================================
create table if not exists public.property_ownerships_cache (
  ownership_id uuid primary key,      -- mirrors ownerships.id
  property_id  uuid not null,
  owner_id     uuid not null,
  contact_id   bigint not null,       -- mirrors contacts.id (bigserial)
  display_name  text,
  primary_email text,
  "primary"     boolean not null default false,
  ownership_percentage    numeric(5,2) not null,
  disbursement_percentage numeric(5,2) not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_poc_property on public.property_ownerships_cache (property_id);
create index if not exists idx_poc_email_lower on public.property_ownerships_cache (lower(primary_email));
create index if not exists idx_poc_display_name on public.property_ownerships_cache (display_name);

-- Upsert helper: recompute one ownership row
create or replace function public.upsert_property_ownerships_cache(p_ownership_id uuid)
returns void language sql as $$
insert into public.property_ownerships_cache as t (
  ownership_id, property_id, owner_id, contact_id, display_name, primary_email,
        "primary", ownership_percentage, disbursement_percentage, updated_at
)
select
  ow.id, ow.property_id, ow.owner_id, c.id,
  coalesce(nullif(trim(c.first_name||' '||c.last_name),''), c.company_name),
  c.primary_email,
  ow.primary, ow.ownership_percentage, ow.disbursement_percentage,
  now()
from public.ownerships ow
join public.owners o   on o.id = ow.owner_id
join public.contacts c on c.id = o.contact_id
where ow.id = p_ownership_id
on conflict (ownership_id) do update
  set property_id  = excluded.property_id,
      owner_id     = excluded.owner_id,
      contact_id   = excluded.contact_id,
      display_name = excluded.display_name,
      primary_email= excluded.primary_email,
      "primary"     = excluded."primary",
      ownership_percentage    = excluded.ownership_percentage,
      disbursement_percentage = excluded.disbursement_percentage,
      updated_at = now();
$$;

-- Triggers: ownerships changes → cache
create or replace function public.trg_ownerships_to_cache() returns trigger language plpgsql as $$
begin
  perform public.upsert_property_ownerships_cache(coalesce(new.id, old.id));
  return new;
end$$;

drop trigger if exists ownerships_to_cache on public.ownerships;
create trigger ownerships_to_cache
after insert or update on public.ownerships
for each row execute function public.trg_ownerships_to_cache();

-- Triggers: contacts identity changes → cascade into ownerships cache
create or replace function public.trg_contacts_to_poc() returns trigger language plpgsql as $$
begin
  update public.property_ownerships_cache t
     set display_name  = coalesce(nullif(trim(new.first_name||' '||new.last_name),''), new.company_name),
         primary_email = new.primary_email,
         updated_at = now()
  from public.owners o
  join public.ownerships ow on ow.owner_id = o.id
  where o.contact_id = new.id
    and t.ownership_id = ow.id;
  return new;
end$$;

drop trigger if exists contacts_to_poc on public.contacts;
create trigger contacts_to_poc
after update of first_name,last_name,company_name,primary_email on public.contacts
for each row execute function public.trg_contacts_to_poc();

-- Optional: keep updated_at fresh on cache updates
drop trigger if exists trg_poc_updated_at on public.property_ownerships_cache;
create trigger trg_poc_updated_at
before update on public.property_ownerships_cache
for each row execute function public.set_updated_at();

-- One-time backfill
do $$
begin
  insert into public.property_ownerships_cache (
    ownership_id, property_id, owner_id, contact_id, display_name, primary_email,
    "primary", ownership_percentage, disbursement_percentage
  )
  select
    ow.id, ow.property_id, ow.owner_id, c.id,
    coalesce(nullif(trim(c.first_name||' '||c.last_name),''), c.company_name),
    c.primary_email,
    ow."primary", ow.ownership_percentage, ow.disbursement_percentage
  from public.ownerships ow
  join public.owners o   on o.id = ow.owner_id
  join public.contacts c on c.id = o.contact_id
  on conflict (ownership_id) do nothing;
end$$;
