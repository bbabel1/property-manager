-- Add normalized key columns for Buildium webhook idempotency
alter table if exists public.buildium_webhook_events
  add column if not exists buildium_webhook_id text,
  add column if not exists event_name text,
  add column if not exists event_created_at timestamptz;

-- Backfill from existing payloads and metadata
update public.buildium_webhook_events
set
  event_name = coalesce(event_name, event_type, event_data->>'EventType', event_data->>'EventName', 'unknown'),
  buildium_webhook_id = coalesce(
    buildium_webhook_id,
    event_id,
    event_data->>'Id',
    event_data->>'EventId',
    event_data->>'eventId',
    event_data->>'TransactionId',
    event_data->>'LeaseId',
    event_data->>'EntityId',
    event_data->'Data'->>'TransactionId',
    concat_ws('-', event_type, event_data->>'EntityId', event_data->>'LeaseId')
  ),
  event_created_at = coalesce(
    event_created_at,
    (event_data->>'EventDateTime')::timestamptz,
    (event_data->>'EventDate')::timestamptz,
    (event_data->>'EventTimestamp')::timestamptz,
    (event_data->>'eventDateTime')::timestamptz,
    created_at,
    to_timestamp(0)
  );

-- Drop duplicates keeping the first encountered row
delete from public.buildium_webhook_events a
using public.buildium_webhook_events b
where a.ctid < b.ctid
  and coalesce(a.buildium_webhook_id, '') = coalesce(b.buildium_webhook_id, '')
  and coalesce(a.event_name, '') = coalesce(b.event_name, '')
  and coalesce(a.event_created_at, to_timestamp(0)) = coalesce(b.event_created_at, to_timestamp(0));

-- Enforce non-nullability post-backfill
alter table public.buildium_webhook_events
  alter column buildium_webhook_id set not null,
  alter column event_name set not null,
  alter column event_created_at set not null;

-- Index to support idempotent lookups
create unique index if not exists uq_buildium_webhook_events_compound
  on public.buildium_webhook_events(buildium_webhook_id, event_name, event_created_at);
