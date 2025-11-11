-- Create table to store local property notes independent of Buildium
create table if not exists public.property_notes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  subject text not null,
  body text not null,
  is_private boolean not null default false,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists property_notes_property_id_idx on public.property_notes(property_id);
