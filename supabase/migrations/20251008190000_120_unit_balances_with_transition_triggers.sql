-- Unit balances: schema, lookup tables, function, statement-level triggers, backfill
-- Safe to re-run components using IF NOT EXISTS where possible

-- 1) Schema: extend units with balance fields
alter table if exists public.units
  add column if not exists balance numeric null,
  add column if not exists prepayments_balance numeric null,
  add column if not exists deposits_held_balance numeric null,
  add column if not exists balance_updated_at timestamptz null;

-- 2) Lookup tables for data-driven rules
create table if not exists public.transaction_type_sign (
  transaction_type transaction_type_enum primary key,
  sign int not null check (sign in (-1,1))
);

insert into public.transaction_type_sign (transaction_type, sign) values
  ('Charge', 1),
  ('Bill', 1),
  ('Payment', -1),
  ('Credit', -1),
  ('Refund', -1),
  ('ReversePayment', 1),
  ('VendorCredit', -1),
  ('VendorRefund', -1),
  ('ApplyDeposit', -1),
  ('OwnerContribution', -1),
  ('ReverseOwnerContribution', 1)
on conflict (transaction_type) do update set sign = excluded.sign;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'gl_category') then
    create type gl_category as enum ('receivable','prepayment','deposit','income','expense','other');
  end if;
end $$;

create table if not exists public.gl_account_category (
  gl_account_id uuid primary key references public.gl_accounts(id) on delete cascade,
  category gl_category not null
);

-- Seed from existing gl_accounts characteristics when present
insert into public.gl_account_category (gl_account_id, category)
select
  id,
  case
    when coalesce(is_security_deposit_liability, false) then 'deposit'::gl_category
    when coalesce(sub_type, '') = 'AccountsReceivable' then 'receivable'::gl_category
    when coalesce(type, '') ilike 'revenue' then 'income'::gl_category
    when coalesce(type, '') ilike 'expense' then 'expense'::gl_category
    when lower(coalesce(name,'')) like '%prepay%' then 'prepayment'::gl_category
    else 'other'::gl_category
  end
from public.gl_accounts
on conflict (gl_account_id) do nothing;

-- 3) Helpful indexes for aggregation paths
create index if not exists idx_transactions_lease_id on public.transactions(lease_id);
create index if not exists idx_transactions_lease_type on public.transactions(lease_id, transaction_type);
create index if not exists idx_tx_lines_unit on public.transaction_lines(unit_id);
create index if not exists idx_tx_lines_lease on public.transaction_lines(lease_id);
create index if not exists idx_tx_lines_tx on public.transaction_lines(transaction_id);
create index if not exists idx_tx_lines_gl on public.transaction_lines(gl_account_id);

-- 4) Recalculation function
create or replace function public.fn_recalculate_unit_financials(p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_started_at timestamptz := now();
begin
  -- Serialize concurrent updates on this unit
  perform 1 from public.units where id = p_unit_id for update;

  with leases as (
    select id from public.lease where unit_id = p_unit_id
  ),
  tx as (
    select t.id, t.total_amount, coalesce(s.sign, 1) as sign
    from public.transactions t
    join leases l on l.id = t.lease_id
    left join public.transaction_type_sign s on s.transaction_type = t.transaction_type
  ),
  ar as (
    select coalesce(sum(total_amount * sign), 0) as balance from tx
  ),
  lines as (
    select tl.amount, tl.posting_type, gac.category
    from public.transaction_lines tl
    left join public.gl_account_category gac on gac.gl_account_id = tl.gl_account_id
    where tl.unit_id = p_unit_id
  ),
  agg as (
    select
      (select balance from ar) as balance,
      coalesce(sum(case when category = 'prepayment'
                        then case when posting_type = 'Credit' then amount else -amount end end), 0) as prepayments,
      coalesce(sum(case when category = 'deposit'
                        then case when posting_type = 'Credit' then amount else -amount end end), 0) as deposits
    from lines
  )
  update public.units u
     set balance = a.balance,
         prepayments_balance = a.prepayments,
         deposits_held_balance = a.deposits,
         balance_updated_at = v_started_at
  from agg a
  where u.id = p_unit_id;
end $$;

-- 5) Statement-level triggers using transition tables

create or replace function public.trg_units_recalc_from_transactions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r record;
begin
  if tg_op = 'INSERT' then
    for r in
      select distinct l.unit_id
      from new_table x
      join public.lease l on l.id = x.lease_id
      where l.unit_id is not null
    loop
      perform public.fn_recalculate_unit_financials(r.unit_id);
    end loop;
  elsif tg_op = 'DELETE' then
    for r in
      select distinct l.unit_id
      from old_table x
      join public.lease l on l.id = x.lease_id
      where l.unit_id is not null
    loop
      perform public.fn_recalculate_unit_financials(r.unit_id);
    end loop;
  elsif tg_op = 'UPDATE' then
    for r in
      select distinct l.unit_id
      from (
        select lease_id from new_table
        union
        select lease_id from old_table
      ) x
      join public.lease l on l.id = x.lease_id
      where l.unit_id is not null
    loop
      perform public.fn_recalculate_unit_financials(r.unit_id);
    end loop;
  end if;
  return null;
end $$;

drop trigger if exists trg_units_recalc_on_transactions_insert on public.transactions;
drop trigger if exists trg_units_recalc_on_transactions_update on public.transactions;
drop trigger if exists trg_units_recalc_on_transactions_delete on public.transactions;

create trigger trg_units_recalc_on_transactions_insert
  after insert on public.transactions
  referencing new table as new_table
  for each statement execute function public.trg_units_recalc_from_transactions();

create trigger trg_units_recalc_on_transactions_update
  after update on public.transactions
  referencing new table as new_table old table as old_table
  for each statement execute function public.trg_units_recalc_from_transactions();

create trigger trg_units_recalc_on_transactions_delete
  after delete on public.transactions
  referencing old table as old_table
  for each statement execute function public.trg_units_recalc_from_transactions();


create or replace function public.trg_units_recalc_from_tx_lines()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r record;
begin
  if tg_op = 'INSERT' then
    -- Recalc for units referenced directly by unit_id
    for r in (select distinct unit_id as id from new_table where unit_id is not null) loop
      perform public.fn_recalculate_unit_financials(r.id);
    end loop;
    -- Recalc for units inferred via lease_id
    for r in (
      select distinct l.unit_id as id
      from new_table x
      join public.lease l on l.id = x.lease_id
      where l.unit_id is not null
    ) loop
      perform public.fn_recalculate_unit_financials(r.id);
    end loop;
  elsif tg_op = 'DELETE' then
    -- Recalc for units referenced directly by unit_id
    for r in (select distinct unit_id as id from old_table where unit_id is not null) loop
      perform public.fn_recalculate_unit_financials(r.id);
    end loop;
    -- Recalc for units inferred via lease_id
    for r in (
      select distinct l.unit_id as id
      from old_table x
      join public.lease l on l.id = x.lease_id
      where l.unit_id is not null
    ) loop
      perform public.fn_recalculate_unit_financials(r.id);
    end loop;
  elsif tg_op = 'UPDATE' then
    -- Recalc for units referenced directly by unit_id
    for r in (
      select distinct unit_id as id from new_table where unit_id is not null
      union
      select distinct unit_id as id from old_table where unit_id is not null
    ) loop
      perform public.fn_recalculate_unit_financials(r.id);
    end loop;
    -- Recalc for units inferred via lease_id
    for r in (
      select distinct l.unit_id as id
      from (
        select lease_id from new_table
        union
        select lease_id from old_table
      ) x
      join public.lease l on l.id = x.lease_id
      where l.unit_id is not null
    ) loop
      perform public.fn_recalculate_unit_financials(r.id);
    end loop;
  end if;

  return null;
end $$;

drop trigger if exists trg_units_recalc_on_tx_lines_insert on public.transaction_lines;
drop trigger if exists trg_units_recalc_on_tx_lines_update on public.transaction_lines;
drop trigger if exists trg_units_recalc_on_tx_lines_delete on public.transaction_lines;

create trigger trg_units_recalc_on_tx_lines_insert
  after insert on public.transaction_lines
  referencing new table as new_table
  for each statement execute function public.trg_units_recalc_from_tx_lines();

create trigger trg_units_recalc_on_tx_lines_update
  after update on public.transaction_lines
  referencing new table as new_table old table as old_table
  for each statement execute function public.trg_units_recalc_from_tx_lines();

create trigger trg_units_recalc_on_tx_lines_delete
  after delete on public.transaction_lines
  referencing old table as old_table
  for each statement execute function public.trg_units_recalc_from_tx_lines();

-- 6) Backfill: compute balances for all units now
do $$
declare r record;
begin
  for r in select id from public.units loop
    perform public.fn_recalculate_unit_financials(r.id);
  end loop;
end $$;

