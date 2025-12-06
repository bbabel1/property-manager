-- Harden buildium_webhook_events schema for idempotent ingest and query performance

-- Add missing columns used by edge functions
alter table if exists public.buildium_webhook_events
  add column if not exists webhook_type text,
  add column if not exists signature text,
  add column if not exists event_entity_id text,
  add column if not exists payload jsonb,
  add column if not exists status text default 'received',
  add column if not exists received_at timestamptz default now(),
  add column if not exists error text;

-- Backfill event_entity_id with available identifiers or a stable fallback
update public.buildium_webhook_events
set event_entity_id = coalesce(
  event_entity_id,
  event_data->>'EntityId',
  event_data->>'LeaseId',
  event_data->>'TransactionId',
  event_data->>'PropertyId',
  event_data->>'UnitId',
  event_data->>'BillId',
  event_data->'Data'->>'TransactionId',
  'unknown'
) ,
payload = coalesce(payload, event_data);

-- Normalize required booleans/strings prior to constraint changes
update public.buildium_webhook_events
set processed = coalesce(processed, false),
    event_name = coalesce(event_name, event_type, 'unknown'),
    event_created_at = coalesce(event_created_at, created_at, received_at, to_timestamp(0)),
    event_type = coalesce(event_type, event_name, 'unknown');

-- Enforce required fields
alter table public.buildium_webhook_events
  alter column event_name set not null,
  alter column event_created_at set not null,
  alter column event_entity_id set not null,
  alter column event_type set not null,
  alter column event_data set not null,
  alter column processed set not null;

-- Ensure org foreign key uses safe cascading behavior
do $$ begin
  if exists (
    select 1 from pg_constraint
    where conname = 'buildium_webhook_events_org_id_fkey'
  ) then
    alter table public.buildium_webhook_events
      drop constraint buildium_webhook_events_org_id_fkey;
  end if;
  alter table public.buildium_webhook_events
    add constraint buildium_webhook_events_org_id_fkey
      foreign key (org_id) references public.organizations(id) on delete set null;
exception when others then
  -- ignore if the constraint already matches the desired definition
end $$;

-- Indices for common predicates
create index if not exists idx_buildium_webhook_events_event_name on public.buildium_webhook_events(event_name);
create index if not exists idx_buildium_webhook_events_event_created_at on public.buildium_webhook_events(event_created_at desc);
create index if not exists idx_buildium_webhook_events_processed on public.buildium_webhook_events(processed, processed_at);
create index if not exists idx_buildium_webhook_events_entity on public.buildium_webhook_events(event_entity_id);
create index if not exists idx_buildium_webhook_events_status on public.buildium_webhook_events(status);

-- Retain existing compound uniqueness if not already applied
create unique index if not exists uq_buildium_webhook_events_compound
  on public.buildium_webhook_events(buildium_webhook_id, event_name, event_created_at);
