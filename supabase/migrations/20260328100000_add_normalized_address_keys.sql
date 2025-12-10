-- Add normalized_address_key to properties and buildings for duplicate detection / reuse

alter table public.properties
  add column if not exists normalized_address_key text;

alter table public.buildings
  add column if not exists normalized_address_key text;

create index if not exists idx_properties_normalized_address_key on public.properties (normalized_address_key);
create index if not exists idx_buildings_normalized_address_key on public.buildings (normalized_address_key);
