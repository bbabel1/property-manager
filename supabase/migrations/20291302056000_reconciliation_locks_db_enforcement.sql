-- Enforce reconciliation locks at the DB layer for bill applications and expose read-side flag

begin;

-- Helper to check reconciliation status for a transaction
create or replace function public.check_payment_reconciliation_status(
  p_transaction_id uuid
) returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_is_reconciled boolean;
begin
  select exists (
    select 1
    from public.bank_register_state brs
    where brs.transaction_id = p_transaction_id
      and brs.status = 'reconciled'
  ) into v_is_reconciled;

  return coalesce(v_is_reconciled, false);
end;
$$;

comment on function public.check_payment_reconciliation_status(uuid) is
  'Returns true when a transaction has reconciled bank register state.';

-- Stored flag for read-side checks (maintained via trigger)
alter table public.transactions
  add column if not exists is_reconciled boolean default false;

-- Trigger to maintain is_reconciled flag when bank_register_state changes
create or replace function public.trg_update_transaction_reconciled_flag()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    update public.transactions
    set is_reconciled = false
    where id = old.transaction_id;
    return old;
  else
    update public.transactions
    set is_reconciled = (new.status = 'reconciled')
    where id = new.transaction_id;
    return new;
  end if;
end;
$$;

drop trigger if exists trg_update_transaction_reconciled_flag on public.bank_register_state;
create trigger trg_update_transaction_reconciled_flag
  after insert or update or delete on public.bank_register_state
  for each row
  execute function public.trg_update_transaction_reconciled_flag();

-- Initial backfill of is_reconciled flag
update public.transactions t
set is_reconciled = exists (
  select 1
  from public.bank_register_state brs
  where brs.transaction_id = t.id
    and brs.status = 'reconciled'
)
where t.is_reconciled is distinct from exists (
  select 1
  from public.bank_register_state brs
  where brs.transaction_id = t.id
    and brs.status = 'reconciled'
);

-- Trigger to block updates/deletes on bill_applications when source is reconciled
create or replace function public.trg_prevent_reconciled_application_edit()
returns trigger
language plpgsql
as $$
declare
  v_tx uuid;
begin
  v_tx := coalesce(new.source_transaction_id, old.source_transaction_id);
  if v_tx is not null and public.check_payment_reconciliation_status(v_tx) then
    raise exception 'Cannot modify application: source payment is reconciled' using errcode = '23505';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_bill_applications_reconciled_lock on public.bill_applications;
create trigger trg_bill_applications_reconciled_lock
  before update or delete on public.bill_applications
  for each row
  execute function public.trg_prevent_reconciled_application_edit();

commit;
