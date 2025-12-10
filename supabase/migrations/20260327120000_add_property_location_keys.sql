-- Add key location identifiers directly on properties for NYC datasets

alter table public.properties
  add column if not exists bbl text,
  add column if not exists block integer,
  add column if not exists lot integer,
  add column if not exists borough_code smallint,
  add column if not exists hpd_building_id integer,
  add column if not exists hpd_registration_id integer;

-- Basic format/quality checks (nullable-safe)
alter table public.properties
  drop constraint if exists properties_bbl_format_chk,
  add constraint properties_bbl_format_chk check (bbl is null or bbl ~ '^[0-9]{10}$');

alter table public.properties
  drop constraint if exists properties_block_positive_chk,
  add constraint properties_block_positive_chk check (block is null or block > 0);

alter table public.properties
  drop constraint if exists properties_lot_positive_chk,
  add constraint properties_lot_positive_chk check (lot is null or lot > 0);

alter table public.properties
  drop constraint if exists properties_borough_code_range_chk,
  add constraint properties_borough_code_range_chk check (borough_code is null or (borough_code >= 1 and borough_code <= 5));

-- Helpful indexes for lookups
create index if not exists idx_properties_bbl on public.properties (bbl);
create index if not exists idx_properties_block_lot on public.properties (block, lot);
