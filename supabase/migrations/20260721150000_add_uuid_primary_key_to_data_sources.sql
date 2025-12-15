-- Add stable UUID primary key to data_sources while keeping the slug key unique for lookups.

alter table public.data_sources
  add column if not exists id uuid default gen_random_uuid() not null;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'data_sources_pkey') then
    alter table public.data_sources drop constraint data_sources_pkey;
  end if;
end $$;

alter table public.data_sources
  add constraint data_sources_pkey primary key (id);

alter table public.data_sources
  add constraint data_sources_key_key unique (key);

comment on column public.data_sources.id is 'Stable UUID identifier for this data source';
