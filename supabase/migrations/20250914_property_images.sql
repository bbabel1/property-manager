-- Property images table to persist Buildium or locally stored images per property
set check_function_bodies = off;

create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  buildium_image_id integer null,
  name text,
  description text,
  file_type text,
  file_size integer,
  is_private boolean,
  href text,
  sort_index integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_images_property_id_idx on public.property_images(property_id);
create unique index if not exists property_images_buildium_image_id_key on public.property_images(buildium_image_id) where buildium_image_id is not null;

create trigger trg_property_images_updated_at
before update on public.property_images
for each row execute function public.set_updated_at();

-- RLS can be enabled later; server uses service role for write operations.

