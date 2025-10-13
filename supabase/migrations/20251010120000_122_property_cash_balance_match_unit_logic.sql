-- Update property cash balance calculation to match unit balance logic
-- Use transactions table instead of transaction_lines for consistency
-- 1) Update the recalculation function to use transactions approach (like units)
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
-- Cash balance using transactions approach (matching unit balance logic)
with leases as (
    select id
    from public.lease
    where property_id = p_property_id
),
tx as (
    select t.id,
        t.total_amount,
        coalesce(s.sign, 1) as sign
    from public.transactions t
        join leases l on l.id = t.lease_id
        left join public.transaction_type_sign s on s.transaction_type = t.transaction_type
)
select coalesce(sum(total_amount * sign), 0) into v_cash
from tx;
-- Security deposits & early payments: deposit liability and prepayment categories
-- (Keep using transaction_lines for GL-based categorization)
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
-- 2) Update the get_property_financials function to use the same logic
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
-- Fallback: compute using transactions approach (matching unit logic)
return (
    with leases as (
        select id
        from public.lease
        where property_id = p_property_id
    ),
    tx as (
        select t.id,
            t.total_amount,
            coalesce(s.sign, 1) as sign
        from public.transactions t
            join leases l on l.id = t.lease_id
            left join public.transaction_type_sign s on s.transaction_type = t.transaction_type
        where t.date <= p_as_of
    ),
    cash as (
        select coalesce(sum(total_amount * sign), 0) as v
        from tx
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
-- 3) Add triggers for transactions table (matching unit triggers)
-- Create trigger function for transactions table
create or replace function public.trg_properties_recalc_from_transactions() returns trigger language plpgsql security definer
set search_path = public,
    pg_temp as $$
declare r record;
begin if tg_op = 'INSERT' then for r in (
    select distinct l.property_id as id
    from new_table x
        join public.lease l on l.id = x.lease_id
    where l.property_id is not null
) loop perform public.fn_recalculate_property_financials(r.id);
end loop;
elsif tg_op = 'DELETE' then for r in (
    select distinct l.property_id as id
    from old_table x
        join public.lease l on l.id = x.lease_id
    where l.property_id is not null
) loop perform public.fn_recalculate_property_financials(r.id);
end loop;
elsif tg_op = 'UPDATE' then for r in (
    select distinct l.property_id as id
    from (
            select lease_id
            from new_table
            union
            select lease_id
            from old_table
        ) x
        join public.lease l on l.id = x.lease_id
    where l.property_id is not null
) loop perform public.fn_recalculate_property_financials(r.id);
end loop;
end if;
return null;
end $$;
-- Create triggers for transactions table (separate triggers per event type)
drop trigger if exists trg_properties_recalc_on_transactions_insert on public.transactions;
drop trigger if exists trg_properties_recalc_on_transactions_update_new on public.transactions;
drop trigger if exists trg_properties_recalc_on_transactions_update_old on public.transactions;
drop trigger if exists trg_properties_recalc_on_transactions_delete on public.transactions;
create trigger trg_properties_recalc_on_transactions_insert
after
insert on public.transactions referencing new table as new_table for each statement execute function public.trg_properties_recalc_from_transactions();
-- For UPDATE, we need to recalc properties from both old and new rows
create trigger trg_properties_recalc_on_transactions_update_new
after
update on public.transactions referencing new table as new_table for each statement execute function public.trg_properties_recalc_from_transactions();
create trigger trg_properties_recalc_on_transactions_update_old
after
update on public.transactions referencing old table as old_table for each statement execute function public.trg_properties_recalc_from_transactions();
create trigger trg_properties_recalc_on_transactions_delete
after delete on public.transactions referencing old table as old_table for each statement execute function public.trg_properties_recalc_from_transactions();
-- 4) Backfill all properties with the new calculation
do $$
declare r record;
begin for r in
select id
from public.properties loop perform public.fn_recalculate_property_financials(r.id);
end loop;
end $$;
-- 5) Add comment explaining the change
comment on function public.fn_recalculate_property_financials(uuid) is 'Recalculates property cash balance using transactions table (matching unit balance logic) for consistency';
comment on function public.get_property_financials(uuid, date) is 'Returns property financials with cash balance calculated from transactions table (consistent with unit balance calculation)';

