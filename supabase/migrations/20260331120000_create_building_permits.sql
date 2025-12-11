-- Store DOB NOW: Build approved permits / job filings per building + unit
-- Includes raw metadata for every source column to avoid lossy ingestion.

-- Building permits (one row per permit/job filing)
create table if not exists public.building_permits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  building_id uuid references public.buildings(id),
  source text not null default 'dob_now_build_approved_permits',
  dataset_id text not null default 'rbx6-tga4',
  source_record_id text,
  job_filing_number text not null,
  work_permit text,
  sequence_number text,
  filing_reason text,
  work_type text,
  permit_status text,
  work_on_floor text,
  apt_condo_no_s text,
  permittee_license_type text,
  applicant_license text,
  applicant_business_name text,
  applicant_business_address text,
  filing_representative_business_name text,
  owner_business_name text,
  owner_name text,
  owner_street_address text,
  owner_city text,
  owner_state text,
  owner_zip_code text,
  job_description text,
  estimated_job_costs text,
  approved_date date,
  issued_date date,
  expired_date date,
  tracking_number text,
  house_no text,
  street_name text,
  borough text,
  bin text,
  block text,
  lot text,
  bbl text,
  c_b_no text,
  zip_code text,
  community_board numeric,
  council_district numeric,
  census_tract numeric,
  nta text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.building_permits is 'Building/job permits keyed to buildings/units with full raw metadata for DOB NOW and related sources.';
comment on column public.building_permits.source is 'Normalized source identifier (e.g., dob_now_build_approved_permits, manual).';
comment on column public.building_permits.dataset_id is 'Source dataset identifier (Socrata dataset ID when applicable).';
comment on column public.building_permits.metadata is 'Raw source payload retaining every column (see DOB NOW Build – Approved Permits fields).';

-- Keep updated_at fresh
drop trigger if exists trg_building_permits_updated_at on public.building_permits;
create trigger trg_building_permits_updated_at
  before update on public.building_permits
  for each row execute function public.set_updated_at();

-- Dedup & lookup indexes
create unique index if not exists building_permits_dedup_uidx
  on public.building_permits (org_id, source, job_filing_number, coalesce(work_permit, ''), coalesce(sequence_number, ''));
create index if not exists building_permits_property_idx on public.building_permits (property_id);
create index if not exists building_permits_building_idx on public.building_permits (building_id);
create index if not exists building_permits_bin_idx on public.building_permits (bin) where bin is not null;
create index if not exists building_permits_bbl_idx on public.building_permits (bbl) where bbl is not null;

-- RLS
alter table public.building_permits enable row level security;

create policy "building_permits_org_read"
  on public.building_permits for select
  using (public.is_org_member(auth.uid(), org_id));

create policy "building_permits_org_insert"
  on public.building_permits for insert
  with check (auth.uid() is not null and public.is_org_member(auth.uid(), org_id));

create policy "building_permits_org_update"
  on public.building_permits for update
  using (auth.uid() is not null and public.is_org_member(auth.uid(), org_id))
  with check (auth.uid() is not null and public.is_org_member(auth.uid(), org_id));

create policy "building_permits_org_delete"
  on public.building_permits for delete
  using (auth.uid() is not null and public.is_org_member(auth.uid(), org_id));

create policy "building_permits_service_role_full_access"
  on public.building_permits
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Join table to tag permits to multiple units (optional)
create table if not exists public.building_permit_units (
  id uuid primary key default gen_random_uuid(),
  permit_id uuid not null references public.building_permits(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  unit_reference text,
  created_at timestamptz not null default now()
);

comment on table public.building_permit_units is 'Optional mapping from permits to one or more units (stores unit_id or freeform reference).';

create unique index if not exists building_permit_units_unique_unit_idx
  on public.building_permit_units (permit_id, unit_id) where unit_id is not null;
create index if not exists building_permit_units_permit_idx
  on public.building_permit_units (permit_id);

alter table public.building_permit_units enable row level security;

create policy "building_permit_units_org_read"
  on public.building_permit_units for select
  using (
    exists (
      select 1 from public.building_permits p
      where p.id = permit_id and public.is_org_member(auth.uid(), p.org_id)
    )
  );

create policy "building_permit_units_org_insert"
  on public.building_permit_units for insert
  with check (
    auth.uid() is not null and exists (
      select 1 from public.building_permits p
      where p.id = permit_id and public.is_org_member(auth.uid(), p.org_id)
    )
  );

create policy "building_permit_units_org_update"
  on public.building_permit_units for update
  using (
    auth.uid() is not null and exists (
      select 1 from public.building_permits p
      where p.id = permit_id and public.is_org_member(auth.uid(), p.org_id)
    )
  )
  with check (
    auth.uid() is not null and exists (
      select 1 from public.building_permits p
      where p.id = permit_id and public.is_org_member(auth.uid(), p.org_id)
    )
  );

create policy "building_permit_units_org_delete"
  on public.building_permit_units for delete
  using (
    auth.uid() is not null and exists (
      select 1 from public.building_permits p
      where p.id = permit_id and public.is_org_member(auth.uid(), p.org_id)
    )
  );

create policy "building_permit_units_service_role_full_access"
  on public.building_permit_units
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Add dataset slot to NYC Open Data integration config
alter table public.nyc_open_data_integrations
  add column if not exists dataset_dob_now_approved_permits text not null default 'rbx6-tga4';

comment on column public.nyc_open_data_integrations.dataset_dob_now_approved_permits is 'Dataset ID for DOB NOW: Build – Approved Permits.';
