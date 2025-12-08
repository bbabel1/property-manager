-- Standardize property cash calculation: use transaction_lines with bank GL accounts
-- Align unit/property paths and fix get_property_financials fallback
-- This ensures consistent property cash calculation across all environments

-- 1) Fix get_property_financials to use same path resolution as fn_recalculate_property_financials
create or replace function public.get_property_financials(
    p_property_id uuid,
    p_as_of date default current_date
) returns jsonb language plpgsql stable as $$
declare 
    v_cash numeric := null;
    v_reserve numeric := 0;
    v_secdep numeric := null;
    v_available numeric := null;
begin
    -- Try cached values first
    select cash_balance,
        coalesce(reserve, 0),
        security_deposits,
        available_balance 
    into v_cash, v_reserve, v_secdep, v_available
    from public.properties
    where id = p_property_id;
    
    -- If cached fields are populated, return them directly
    if v_cash is not null and v_available is not null then 
        return jsonb_build_object(
            'as_of', p_as_of,
            'cash_balance', coalesce(v_cash, 0),
            'security_deposits', coalesce(v_secdep, 0),
            'reserve', coalesce(v_reserve, 0),
            'available_balance', coalesce(v_available, 0)
        );
    end if;
    
    -- Fallback: compute using transaction_lines with bank GL accounts
    -- Use same path resolution as fn_recalculate_property_financials
    return (
        with cash_lines as (
            select tl.amount, tl.posting_type
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
            and tl.date <= p_as_of
            and ga.is_bank_account = true
            and coalesce(ga.exclude_from_cash_balances, false) = false
        ),
        cash as (
            select coalesce(
                sum(case when posting_type = 'Debit' then amount else -amount end),
                0
            ) as v
            from cash_lines
        )
        select jsonb_build_object(
            'as_of', p_as_of,
            'cash_balance', (select v from cash),
            'security_deposits', 0,
            'reserve', coalesce(v_reserve, 0),
            'available_balance', (select v from cash) - coalesce(v_reserve, 0)
        )
    );
end $$;

-- 2) Ensure transaction_lines have property_id populated when unit_id or lease_id exists
-- This improves data integrity and query performance
create or replace function public.fn_populate_transaction_line_property_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    -- If property_id is already set, skip
    if new.property_id is not null then
        return new;
    end if;
    
    -- Try to get property_id from unit_id
    if new.unit_id is not null then
        select u.property_id into new.property_id
        from public.units u
        where u.id = new.unit_id;
    end if;
    
    -- Try to get property_id from lease_id if still null
    if new.property_id is null and new.lease_id is not null then
        select l.property_id into new.property_id
        from public.lease l
        where l.id = new.lease_id;
    end if;
    
    return new;
end $$;

-- Add trigger to auto-populate property_id
drop trigger if exists trg_populate_transaction_line_property_id on public.transaction_lines;
create trigger trg_populate_transaction_line_property_id
before insert or update on public.transaction_lines
for each row execute function public.fn_populate_transaction_line_property_id();

-- 3) Backfill missing property_id values in transaction_lines
update public.transaction_lines tl
set property_id = (
    select u.property_id
    from public.units u
    where u.id = tl.unit_id
    limit 1
)
where tl.property_id is null and tl.unit_id is not null;

update public.transaction_lines tl
set property_id = (
    select l.property_id
    from public.lease l
    where l.id = tl.lease_id
    limit 1
)
where tl.property_id is null and tl.lease_id is not null;

-- 4) Update comments to document the standardized strategy
comment on function public.fn_recalculate_property_financials(uuid) is 
'Recalculates property cash balance using transaction_lines posted to bank GL accounts (is_bank_account=true). 
Uses comprehensive path resolution: direct property_id, unit_id→property, or lease_id→property. 
Credits reduce cash, debits increase cash. This differs from unit balance which uses transactions table.';

comment on function public.get_property_financials(uuid, date) is 
'Returns property financials with cash balance from bank GL transaction_lines. 
Uses same path resolution as fn_recalculate_property_financials for consistency. 
Different from unit balance which uses transactions table.';

comment on function public.fn_populate_transaction_line_property_id() is 
'Auto-populates property_id in transaction_lines from unit_id or lease_id relationships. 
Improves data integrity and query performance for property cash calculations.';
