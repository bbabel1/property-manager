-- Property cash/available balances cached on properties + triggers to keep fresh
-- 1) Extend properties with cached financial fields
alter table if exists public.properties
add column if not exists cash_balance numeric null,
  add column if not exists security_deposits numeric null,
  add column if not exists available_balance numeric null,
  add column if not exists cash_updated_at timestamptz null;
-- 2) Recalculate function for a property
create or replace function public.fn_recalculate_property_financials(p_property_id uuid) returns void language plpgsql security definer
set search_path = public,
  pg_temp as $$
declare v_started_at timestamptz := now();
v_reserve numeric := 0;
v_cash numeric := 0;
v_secdep numeric := 0;
v_available numeric := 0;
begin -- lock property row to serialize
perform 1
from public.properties
where id = p_property_id for
update;
select coalesce(reserve, 0) into v_reserve
from public.properties
where id = p_property_id;
-- Cash = bank accounts (not excluded), credits negative, debits positive
with lines as (
  select tl.amount,
    tl.posting_type
  from public.transaction_lines tl
    join public.gl_accounts ga on ga.id = tl.gl_account_id
  where (
      tl.property_id = p_property_id
      or (
        tl.unit_id is not null
        and exists (
          select 1
          from public.units u
          where u.id = tl.unit_id
            and u.property_id = p_property_id
        )
      )
      or (
        tl.lease_id is not null
        and exists (
          select 1
          from public.lease l
          where l.id = tl.lease_id
            and l.property_id = p_property_id
        )
      )
    )
    and ga.is_bank_account is true
    and coalesce(ga.exclude_from_cash_balances, false) = false
)
select coalesce(
    sum(
      case
        when posting_type = 'Debit' then amount
        else - amount
      end
    ),
    0
  ) into v_cash
from lines;
-- Security deposits & early payments: deposit liability and prepayment categories
with cat_lines as (
  select tl.amount,
    tl.posting_type,
    coalesce(
      gac.category,
      case
        when coalesce(ga.is_security_deposit_liability, false) then 'deposit'::gl_category
        when coalesce(ga.sub_type, '') = 'AccountsReceivable' then 'receivable'::gl_category
        when lower(coalesce(ga.name, '')) like '%prepay%' then 'prepayment'::gl_category
        else 'other'::gl_category
      end
    ) as category
  from public.transaction_lines tl
    join public.gl_accounts ga on ga.id = tl.gl_account_id
    left join public.gl_account_category gac on gac.gl_account_id = tl.gl_account_id
  where (
      tl.property_id = p_property_id
      or (
        tl.unit_id is not null
        and exists (
          select 1
          from public.units u
          where u.id = tl.unit_id
            and u.property_id = p_property_id
        )
      )
      or (
        tl.lease_id is not null
        and exists (
          select 1
          from public.lease l
          where l.id = tl.lease_id
            and l.property_id = p_property_id
        )
      )
    )
)
select coalesce(
    sum(
      case
        when category in ('deposit', 'prepayment') then case
          when posting_type = 'Credit' then amount
          else - amount
        end
      end
    ),
    0
  ) into v_secdep
from cat_lines;
v_available := coalesce(v_cash, 0) - coalesce(v_reserve, 0) - coalesce(v_secdep, 0);
update public.properties p
set cash_balance = v_cash,
  security_deposits = v_secdep,
  available_balance = v_available,
  cash_updated_at = v_started_at
where p.id = p_property_id;
end $$;
-- 3) Statement-level trigger functions for transaction_lines to recalc affected properties
-- INSERT/UPDATE version (uses new_table)
create or replace function public.trg_properties_recalc_from_tx_lines_insert_update() returns trigger language plpgsql security definer
set search_path = public,
  pg_temp as $$
declare r record;
begin -- Direct property_id from new rows
for r in (
  select distinct property_id as id
  from new_table
  where property_id is not null
) loop perform public.fn_recalculate_property_financials(r.id);
end loop;
-- From unit_id in new rows
for r in (
  select distinct u.property_id as id
  from (
      select distinct unit_id
      from new_table
      where unit_id is not null
    ) x
    join public.units u on u.id = x.unit_id
) loop perform public.fn_recalculate_property_financials(r.id);
end loop;
-- From lease_id in new rows
for r in (
  select distinct l.property_id as id
  from (
      select distinct lease_id
      from new_table
      where lease_id is not null
    ) x
    join public.lease l on l.id = x.lease_id
) loop perform public.fn_recalculate_property_financials(r.id);
end loop;
return null;
end $$;
-- UPDATE/DELETE version (uses old_table)
create or replace function public.trg_properties_recalc_from_tx_lines_update_delete() returns trigger language plpgsql security definer
set search_path = public,
  pg_temp as $$
declare r record;
begin -- Direct property_id from old rows
for r in (
  select distinct property_id as id
  from old_table
  where property_id is not null
) loop perform public.fn_recalculate_property_financials(r.id);
end loop;
-- From unit_id in old rows
for r in (
  select distinct u.property_id as id
  from (
      select distinct unit_id
      from old_table
      where unit_id is not null
    ) x
    join public.units u on u.id = x.unit_id
) loop perform public.fn_recalculate_property_financials(r.id);
end loop;
-- From lease_id in old rows
for r in (
  select distinct l.property_id as id
  from (
      select distinct lease_id
      from old_table
      where lease_id is not null
    ) x
    join public.lease l on l.id = x.lease_id
) loop perform public.fn_recalculate_property_financials(r.id);
end loop;
return null;
end $$;
-- Create separate triggers for each event type (transition tables require single event)
drop trigger if exists trg_properties_recalc_on_tx_lines_insert on public.transaction_lines;
drop trigger if exists trg_properties_recalc_on_tx_lines_update_new on public.transaction_lines;
drop trigger if exists trg_properties_recalc_on_tx_lines_update_old on public.transaction_lines;
drop trigger if exists trg_properties_recalc_on_tx_lines_delete on public.transaction_lines;
create trigger trg_properties_recalc_on_tx_lines_insert
after
insert on public.transaction_lines referencing new table as new_table for each statement execute function public.trg_properties_recalc_from_tx_lines_insert_update();
-- For UPDATE, we need to recalc properties from both old and new rows
create trigger trg_properties_recalc_on_tx_lines_update_new
after
update on public.transaction_lines referencing new table as new_table for each statement execute function public.trg_properties_recalc_from_tx_lines_insert_update();
create trigger trg_properties_recalc_on_tx_lines_update_old
after
update on public.transaction_lines referencing old table as old_table for each statement execute function public.trg_properties_recalc_from_tx_lines_update_delete();
create trigger trg_properties_recalc_on_tx_lines_delete
after delete on public.transaction_lines referencing old table as old_table for each statement execute function public.trg_properties_recalc_from_tx_lines_update_delete();
-- 4) Update API helper function to prefer cached values when present; fallback to old computation
create or replace function public.get_property_financials(
    p_property_id uuid,
    p_as_of date default current_date
  ) returns jsonb language plpgsql stable as $$
declare v_cash numeric := null;
v_reserve numeric := 0;
v_secdep numeric := null;
v_available numeric := null;
begin
select cash_balance,
  coalesce(reserve, 0),
  security_deposits,
  available_balance into v_cash,
  v_reserve,
  v_secdep,
  v_available
from public.properties
where id = p_property_id;
-- If cached fields are populated, return them directly
if v_cash is not null
and v_available is not null then return jsonb_build_object(
  'as_of',
  p_as_of,
  'cash_balance',
  coalesce(v_cash, 0),
  'security_deposits',
  coalesce(v_secdep, 0),
  'reserve',
  coalesce(v_reserve, 0),
  'available_balance',
  coalesce(v_available, 0)
);
end if;
-- Fallback: compute on the fly (legacy behavior)
return (
  with cash_lines as (
    select tl.amount,
      tl.posting_type
    from public.transaction_lines tl
      join public.gl_accounts ga on ga.id = tl.gl_account_id
    where tl.property_id = p_property_id
      and tl.date <= p_as_of
      and ga.is_bank_account = true
      and coalesce(ga.exclude_from_cash_balances, false) = false
  ),
  cash as (
    select coalesce(
        sum(
          case
            when posting_type = 'Debit' then amount
            else - amount
          end
        ),
        0
      ) as v
    from cash_lines
  )
  select jsonb_build_object(
      'as_of',
      p_as_of,
      'cash_balance',
      (
        select v
        from cash
      ),
      'security_deposits',
      0,
      'reserve',
      coalesce(v_reserve, 0),
      'available_balance',
      (
        select v
        from cash
      ) - coalesce(v_reserve, 0)
    )
);
end $$;
-- 5) Backfill all properties once
do $$
declare r record;
begin for r in
select id
from public.properties loop perform public.fn_recalculate_property_financials(r.id);
end loop;
end $$;