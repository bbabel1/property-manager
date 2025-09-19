-- Metrics table for Buildium sync runs
set check_function_bodies = off;

create table if not exists public.buildium_sync_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null default 'staff_sync',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  scanned_count integer default 0,
  upserted_count integer default 0,
  linked_count integer default 0,
  error_count integer default 0,
  status text not null default 'running', -- running | success | partial | failed
  errors jsonb,
  created_at timestamptz not null default now()
);

create index if not exists buildium_sync_runs_job_started_idx on public.buildium_sync_runs(job_type, started_at desc);

