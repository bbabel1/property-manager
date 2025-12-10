-- Canonical buildings table to centralize enriched building-level metadata
-- sourced from Google → NYC Geoservice → PLUTO → HPD → Registration → NTA.
-- Building data is shared across properties via building_id to prevent duplication.

-- 1) Buildings table
create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  raw_address text,
  house_number text,
  street_name text,
  street_name_normalized text,
  borough_code text,
  city text,
  state text,
  zip_code text,
  country text,
  latitude numeric,
  longitude numeric,
  bbl text,
  bin text,
  parid text,
  ease_digit text,
  condo_num text,
  coop_num text,
  tax_block text,
  tax_lot text,
  tax_map text,
  tax_section text,
  tax_volume text,
  neighborhood text,
  nta_name text,
  nta_code text,
  geoservice jsonb,
  pluto jsonb,
  hpd_building jsonb,
  hpd_registration jsonb,
  nta jsonb,
  geoservice_response_at timestamptz,
  pluto_response_at timestamptz,
  hpd_response_at timestamptz,
  hpd_registration_response_at timestamptz,
  nta_response_at timestamptz,
  enrichment_errors jsonb not null default '[]'::jsonb
);

-- Keep updated_at fresh
drop trigger if exists trg_buildings_updated_at on public.buildings;
create trigger trg_buildings_updated_at
before update on public.buildings
for each row execute function public.set_updated_at();

-- 2) Uniqueness constraints for deduplication keys (nullable-safe)
create unique index if not exists buildings_bbl_uidx on public.buildings (bbl) where bbl is not null;
create unique index if not exists buildings_bin_uidx on public.buildings (bin) where bin is not null;
create unique index if not exists buildings_parid_uidx on public.buildings (parid) where parid is not null;

-- 3) Link properties → buildings
alter table public.properties
  add column if not exists building_id uuid;

-- Drop constraint if exists, then add it (PostgreSQL doesn't support IF NOT EXISTS for constraints)
alter table public.properties
  drop constraint if exists properties_building_id_fkey;

alter table public.properties
  add constraint properties_building_id_fkey
    foreign key (building_id) references public.buildings(id);

create index if not exists properties_building_id_idx
  on public.properties (building_id);

-- 4) Basic RLS (service role write, authenticated read)
alter table public.buildings enable row level security;

drop policy if exists "Allow service role all on buildings" on public.buildings;
create policy "Allow service role all on buildings"
  on public.buildings for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Allow authenticated read buildings" on public.buildings;
create policy "Allow authenticated read buildings"
  on public.buildings for select
  using (true);
