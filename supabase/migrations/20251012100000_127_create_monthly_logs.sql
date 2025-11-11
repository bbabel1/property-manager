set check_function_bodies = off;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'monthly_log_stage') then
    create type public.monthly_log_stage as enum (
      'charges',
      'payments',
      'bills',
      'escrow',
      'management_fees',
      'owner_statements',
      'owner_distributions'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'monthly_log_status') then
    create type public.monthly_log_status as enum (
      'pending',
      'in_progress',
      'complete'
    );
  end if;
end
$$;

create table if not exists public.monthly_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  period_start date not null,
  stage public.monthly_log_stage not null default 'charges',
  status public.monthly_log_status not null default 'pending',
  charges_amount numeric(14,2) not null default 0,
  payments_amount numeric(14,2) not null default 0,
  bills_amount numeric(14,2) not null default 0,
  escrow_amount numeric(14,2) not null default 0,
  management_fees_amount numeric(14,2) not null default 0,
  owner_statement_amount numeric(14,2) not null default 0,
  owner_distribution_amount numeric(14,2) not null default 0,
  sort_index integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_logs_unique_unit_month unique (org_id, unit_id, period_start)
);

create index if not exists monthly_logs_org_id_idx on public.monthly_logs(org_id);
create index if not exists monthly_logs_property_id_idx on public.monthly_logs(property_id);
create index if not exists monthly_logs_unit_id_idx on public.monthly_logs(unit_id);
create index if not exists monthly_logs_period_idx on public.monthly_logs(period_start);
create index if not exists monthly_logs_stage_idx on public.monthly_logs(stage);
create index if not exists monthly_logs_status_idx on public.monthly_logs(status);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create trigger trg_monthly_logs_updated_at
      before update on public.monthly_logs
      for each row execute function public.set_updated_at();
  end if;
end
$$;

alter table public.monthly_logs enable row level security;

comment on table public.monthly_logs is
  'Workflow records for property accounting month-end progress by unit';
