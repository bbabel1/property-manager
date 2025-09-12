-- Reconciliation log with Buildium mirror fields
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

-- Minimal schema delta to mirror Buildium
alter table public.reconciliation_log
  add column if not exists buildium_reconciliation_id int,
  add column if not exists buildium_bank_account_id   int,
  add column if not exists statement_ending_date      date,
  add column if not exists is_finished                boolean not null default false,
  add column if not exists ending_balance             numeric(14,2),
  add column if not exists total_checks_withdrawals   numeric(14,2),
  add column if not exists total_deposits_additions   numeric(14,2);

create unique index if not exists rl_buildium_rec_uidx
  on public.reconciliation_log(buildium_reconciliation_id);

create index if not exists rl_buildium_acct_idx
  on public.reconciliation_log(buildium_bank_account_id, statement_ending_date);

create index if not exists rl_prop_idx on public.reconciliation_log(property_id);
create index if not exists rl_gl_idx on public.reconciliation_log(gl_account_id);

-- Keep legacy as_of coherent with statement_ending_date
create or replace function public.reconciliation_log_sync_as_of()
returns trigger language plpgsql as $$
begin
  if NEW.statement_ending_date is not null then
    NEW.as_of := NEW.statement_ending_date;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_rl_sync_as_of on public.reconciliation_log;
create trigger trg_rl_sync_as_of
before insert or update on public.reconciliation_log
for each row execute function public.reconciliation_log_sync_as_of();

-- RLS: enable and allow org-scoped reads via property linkage
alter table public.reconciliation_log enable row level security;

drop policy if exists rl_org_read on public.reconciliation_log;
create policy rl_org_read on public.reconciliation_log
for select using (
  exists (
    select 1
    from public.properties p
    join public.org_memberships m on m.org_id = p.org_id
    where p.id = reconciliation_log.property_id
      and m.user_id = auth.uid()
  )
);

