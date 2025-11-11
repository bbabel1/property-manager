set check_function_bodies = off;

create table if not exists public.monthly_log_entries (
  id uuid primary key default gen_random_uuid(),
  monthly_log_id uuid not null references public.monthly_logs(id) on delete cascade,
  stage public.monthly_log_stage not null,
  label text not null,
  description text,
  amount numeric(14,2) not null default 0,
  entry_date date,
  status public.monthly_log_status not null default 'pending',
  source_type text,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monthly_log_entries_log_id_idx on public.monthly_log_entries(monthly_log_id);
create index if not exists monthly_log_entries_stage_idx on public.monthly_log_entries(stage);
create index if not exists monthly_log_entries_status_idx on public.monthly_log_entries(status);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create trigger trg_monthly_log_entries_updated_at
      before update on public.monthly_log_entries
      for each row execute function public.set_updated_at();
  end if;
end
$$;

alter table public.monthly_log_entries enable row level security;
