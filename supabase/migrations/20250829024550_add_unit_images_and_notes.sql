-- Add unit_images and unit_notes tables to persist Buildium unit images/notes locally
set check_function_bodies = off;

create table if not exists public.unit_images (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  buildium_image_id integer not null,
  name text,
  description text,
  file_type text,
  file_size integer,
  is_private boolean,
  href text,
  sort_index integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_images_buildium_image_id_key unique (buildium_image_id)
);

create index if not exists unit_images_unit_id_idx on public.unit_images(unit_id);

create trigger trg_unit_images_updated_at
before update on public.unit_images
for each row execute function public.set_updated_at();

create table if not exists public.unit_notes (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  buildium_note_id integer not null,
  subject text,
  body text,
  is_private boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_notes_buildium_note_id_key unique (buildium_note_id)
);

create index if not exists unit_notes_unit_id_idx on public.unit_notes(unit_id);

create trigger trg_unit_notes_updated_at
before update on public.unit_notes
for each row execute function public.set_updated_at();

-- RLS can be configured later; service-role client used in server bypasses RLS.

