create table if not exists public.lease_telemetry_events (
  event text not null,
  org_id text null,
  lease_id bigint null,
  source text null,
  duration_ms numeric null,
  error_message text null,
  prefills jsonb null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists lease_telemetry_events_created_at_idx on public.lease_telemetry_events (created_at desc);
create index if not exists lease_telemetry_events_event_idx on public.lease_telemetry_events (event);
create index if not exists lease_telemetry_events_org_id_idx on public.lease_telemetry_events (org_id);
create index if not exists lease_telemetry_events_lease_id_idx on public.lease_telemetry_events (lease_id);
