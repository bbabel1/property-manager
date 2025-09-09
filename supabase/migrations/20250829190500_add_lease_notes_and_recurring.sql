-- Lease notes table for local persistence
create table if not exists public.lease_notes (
  id uuid primary key default gen_random_uuid(),
  lease_id bigint not null references public.lease(id) on delete cascade,
  buildium_lease_id bigint,
  buildium_note_id bigint,
  subject text,
  body text,
  is_private boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_lease_notes_lease_id on public.lease_notes (lease_id);
create index if not exists idx_lease_notes_buildium_note_id on public.lease_notes (buildium_note_id);

-- Lease recurring transactions table for local persistence
create table if not exists public.lease_recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  lease_id bigint not null references public.lease(id) on delete cascade,
  buildium_lease_id bigint,
  buildium_recurring_id bigint,
  amount numeric,
  description text,
  frequency text,
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_lease_recurring_lease_id on public.lease_recurring_transactions (lease_id);
create index if not exists idx_lease_recurring_buildium_recurring_id on public.lease_recurring_transactions (buildium_recurring_id);

