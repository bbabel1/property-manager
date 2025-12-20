-- Fix fn_recalculate_property_financials to include transaction_lines posted to property's configured bank GL accounts
-- This ensures that transactions posted directly to operating_bank_gl_account_id or deposit_trust_gl_account_id
-- are included in the cash balance calculation, even if they don't have property_id/unit_id/lease_id set

create or replace function public.fn_recalculate_property_financials(p_property_id uuid) 
returns void 
language plpgsql 
security definer
set search_path = public, pg_temp as $$
declare 
    v_started_at timestamptz := now();
    v_reserve numeric := 0;
    v_cash numeric := 0;
    v_secdep numeric := 0;
    v_available numeric := 0;
    v_operating_bank_gl_account_id uuid;
    v_deposit_trust_gl_account_id uuid;
begin 
    -- lock property row to serialize
    perform 1
    from public.properties
    where id = p_property_id for update;
    
    select 
        coalesce(reserve, 0),
        operating_bank_gl_account_id,
        deposit_trust_gl_account_id
    into v_reserve, v_operating_bank_gl_account_id, v_deposit_trust_gl_account_id
    from public.properties
    where id = p_property_id;
    
    -- Cash balance: transaction_lines posted to bank GL accounts
    -- Credits reduce cash, debits increase cash
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
                -- Include transaction_lines posted to the property's configured bank GL accounts
                -- even if they don't have property_id/unit_id/lease_id set
                or (
                    (v_operating_bank_gl_account_id IS NOT NULL AND tl.gl_account_id = v_operating_bank_gl_account_id)
                    or (v_deposit_trust_gl_account_id IS NOT NULL AND tl.gl_account_id = v_deposit_trust_gl_account_id)
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
                -- Include transaction_lines posted to the property's configured bank GL accounts
                -- even if they don't have property_id/unit_id/lease_id set
                or (
                    (v_operating_bank_gl_account_id IS NOT NULL AND tl.gl_account_id = v_operating_bank_gl_account_id)
                    or (v_deposit_trust_gl_account_id IS NOT NULL AND tl.gl_account_id = v_deposit_trust_gl_account_id)
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

comment on function public.fn_recalculate_property_financials(uuid) is 
'Recalculates property cash balance using transaction_lines posted to bank GL accounts (is_bank_account=true). 
Includes transaction_lines posted to the property''s operating_bank_gl_account_id or deposit_trust_gl_account_id 
even if they don''t have property_id/unit_id/lease_id set. Credits reduce cash, debits increase cash.';

