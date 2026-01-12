-- Add transaction locking, reversal linkage, and immutability guards

begin;

-- Org-level config for immutability rollout
create table if not exists public.org_accounting_config (
  org_id uuid primary key references public.organizations(id),
  enforce_immutability boolean default false,
  auto_lock_on_post boolean default false,
  updated_at timestamptz default now()
);

-- Locking columns on transactions
alter table public.transactions
  add column if not exists locked_at timestamptz,
  add column if not exists locked_reason text,
  add column if not exists locked_by_user_id uuid references auth.users(id),
  add column if not exists reversal_of_transaction_id uuid references public.transactions(id);

create unique index if not exists idx_transactions_reversal_unique
  on public.transactions(reversal_of_transaction_id)
  where reversal_of_transaction_id is not null;

-- Prevent modifications when locked (config-driven)
create or replace function public.prevent_locked_transaction_modification()
returns trigger
language plpgsql
as $$
declare
  v_enforce boolean;
  v_tx_id uuid;
begin
  v_tx_id := coalesce(new.transaction_id, old.transaction_id, new.id, old.id);

  select enforce_immutability into v_enforce
  from public.org_accounting_config c
  join public.transactions t on t.org_id = c.org_id
  where t.id = v_tx_id;

  if v_enforce is not true then
    return coalesce(new, old);
  end if;

  if exists (select 1 from public.transactions where id = v_tx_id and locked_at is not null) then
    raise exception 'Cannot modify locked transaction. Create a reversal instead.'
      using errcode = '23505';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prevent_locked_transaction_update on public.transactions;
create trigger trg_prevent_locked_transaction_update
  before update or delete on public.transactions
  for each row
  when (old.locked_at is not null)
  execute function public.prevent_locked_transaction_modification();

drop trigger if exists trg_prevent_locked_transaction_lines_change on public.transaction_lines;
create trigger trg_prevent_locked_transaction_lines_change
  before insert or update or delete on public.transaction_lines
  for each row
  execute function public.prevent_locked_transaction_modification();

-- Locking helper
create or replace function public.lock_transaction(
  p_transaction_id uuid,
  p_reason text,
  p_user_id uuid default auth.uid()
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.transactions
  set locked_at = now(),
      locked_reason = p_reason,
      locked_by_user_id = coalesce(p_user_id, auth.uid())
  where id = p_transaction_id
    and locked_at is null;

  if not found then
    raise exception 'Transaction % not found or already locked', p_transaction_id;
  end if;
end;
$$;

comment on function public.lock_transaction(uuid, text, uuid) is 'Locks a transaction for immutability with a reason and user id';

-- Reversal linkage view
-- Drop first if it exists with different column structure
drop view if exists public.v_transaction_with_reversal;
create view public.v_transaction_with_reversal as
select
  t.*,
  r.id as reversal_id,
  r.date as reversal_date,
  r.memo as reversal_memo,
  r.locked_at as reversal_locked_at
from public.transactions t
left join public.transactions r on r.reversal_of_transaction_id = t.id;

commit;
