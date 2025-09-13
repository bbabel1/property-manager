-- Minimal reconciliation_log setup for remote where org_memberships is absent
-- Creates table and required columns without RLS policies referencing org tables

create table if not exists public.reconciliation_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id),
  bank_account_id uuid references public.bank_accounts(id),
  gl_account_id uuid references public.gl_accounts(id),
  as_of date,
  performed_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.reconciliation_log
  add column if not exists buildium_reconciliation_id int,
  add column if not exists buildium_bank_account_id   int,
  add column if not exists statement_ending_date      date,
  add column if not exists is_finished                boolean not null default false,
  add column if not exists ending_balance             numeric(14,2),
  add column if not exists total_checks_withdrawals   numeric(14,2),
  add column if not exists total_deposits_additions   numeric(14,2);

-- Basic indexes that do not depend on org tables
create unique index if not exists rl_buildium_rec_uidx
  on public.reconciliation_log(buildium_reconciliation_id);

create index if not exists rl_prop_idx on public.reconciliation_log(property_id);
create index if not exists rl_gl_idx on public.reconciliation_log(gl_account_id);

