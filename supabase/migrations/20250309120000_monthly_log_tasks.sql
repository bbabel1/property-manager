-- Monthly log tasks + rules

-- Task source enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_source_enum') then
    create type public.task_source_enum as enum ('buildium', 'manual', 'monthly_log');
  end if;
end$$;

-- Recurrence/automation rules
create table if not exists public.monthly_log_task_rules (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  subject_template text not null,
  description_template text,
  priority text default 'normal',
  status_default text default 'new',
  category_id uuid references public.task_categories(id),
  assigned_to_staff_id integer references public.staff(id),
  due_anchor text default 'period_end',
  due_offset_days integer default 0,
  frequency text default 'monthly',
  interval integer default 1,
  is_active boolean default true,
  property_conditions jsonb,
  unit_conditions jsonb,
  stage_trigger public.monthly_log_stage,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_monthly_log_task_rules_org_id on public.monthly_log_task_rules(org_id);
create index if not exists idx_monthly_log_task_rules_property_conditions on public.monthly_log_task_rules using gin(property_conditions);
create index if not exists idx_monthly_log_task_rules_unit_conditions on public.monthly_log_task_rules using gin(unit_conditions);

-- Rule run history (idempotency + audit)
create table if not exists public.monthly_log_task_rule_runs (
  id uuid default gen_random_uuid() primary key,
  rule_id uuid not null references public.monthly_log_task_rules(id) on delete cascade,
  monthly_log_id uuid not null references public.monthly_logs(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  matched boolean default false,
  reason text,
  evaluated_at timestamptz default now(),
  next_evaluation_at timestamptz
);

create unique index if not exists idx_monthly_log_task_rule_runs_rule_log on public.monthly_log_task_rule_runs(rule_id, monthly_log_id);

-- Task table extensions for monthly-log scope
alter table public.tasks
  add column if not exists monthly_log_id uuid references public.monthly_logs(id) on delete cascade,
  add column if not exists monthly_log_rule_id uuid references public.monthly_log_task_rules(id) on delete set null,
  add column if not exists condition_snapshot jsonb,
  add column if not exists source public.task_source_enum default 'manual';

create index if not exists idx_tasks_monthly_log_id on public.tasks(monthly_log_id) where monthly_log_id is not null;
create index if not exists idx_tasks_monthly_log_rule_id on public.tasks(monthly_log_rule_id) where monthly_log_rule_id is not null;
