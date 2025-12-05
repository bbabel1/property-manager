-- Store toggle state for webhook event names
create table if not exists public.webhook_event_flags (
  event_type text primary key,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webhook_event_flags_enabled_idx on public.webhook_event_flags(enabled);

comment on table public.webhook_event_flags is 'Per-event toggle for Buildium (and other) webhook handlers.';
