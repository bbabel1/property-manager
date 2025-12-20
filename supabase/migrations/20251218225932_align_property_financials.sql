-- Align get_property_financials with shared rollup semantics (bank/payment/deposit/prepay)
-- Bank lines prioritized; payment fallback when no bank lines; deposit/prepay classification by flags/subtypes.

create or replace function public.get_property_financials(
    p_property_id uuid,
    p_as_of date default current_date
) returns jsonb
language plpgsql
stable
as $$
declare
    v_reserve numeric := 0;
    v_cache jsonb;
begin
    -- Try cached property columns first (if populated)
    select jsonb_build_object(
        'cash_balance', cash_balance,
        'security_deposits', security_deposits,
        'reserve', coalesce(reserve, 0),
        'available_balance', available_balance
    )
    into v_cache
    from public.properties
    where id = p_property_id
      and cash_balance is not null
      and available_balance is not null;

    if v_cache is not null then
        return v_cache || jsonb_build_object('as_of', p_as_of);
    end if;

    select coalesce(reserve, 0) into v_reserve from public.properties where id = p_property_id;

    with property_units as (
        select id from public.units where property_id = p_property_id
    ),
    property_leases as (
        select id, buildium_lease_id from public.lease where property_id = p_property_id
    ),
    raw_lines as (
        select tl.*, ga.name as ga_name, ga.type as ga_type, ga.sub_type as ga_sub_type,
               ga.is_bank_account as ga_is_bank, ga.is_security_deposit_liability as ga_is_sdl,
               coalesce(ga.exclude_from_cash_balances, false) as ga_exclude
        from public.transaction_lines tl
        join public.gl_accounts ga on ga.id = tl.gl_account_id
        where tl.date <= p_as_of
          and (
            tl.property_id = p_property_id
            or tl.unit_id in (select id from property_units)
            or tl.lease_id in (select id from property_leases)
            or tl.buildium_lease_id in (select buildium_lease_id from property_leases where buildium_lease_id is not null)
          )
    ),
    classified as (
        select
          id,
          transaction_id,
          amount,
          posting_type,
          ga_type,
          ga_sub_type,
          ga_name,
          ga_is_bank,
          ga_is_sdl,
          ga_exclude,
          -- classification flags
          (ga_is_bank = true or lower(coalesce(ga_sub_type,'')) like '%cash%' or lower(coalesce(ga_name,'')) ~ '(bank|checking|operating|trust)' or lower(coalesce(ga_type,'')) = 'asset') as bank_flag,
          (ga_is_sdl = true or (lower(coalesce(ga_sub_type,'')) like '%deposit%' and lower(coalesce(ga_type,'')) = 'liability') or lower(coalesce(ga_name,'')) like '%deposit%') as deposit_flag,
          ((lower(coalesce(ga_sub_type,'')) like '%prepay%' or lower(coalesce(ga_sub_type,'')) like '%prepaid%' or lower(coalesce(ga_sub_type,'')) like '%advance%' or lower(coalesce(ga_name,'')) like '%prepay%' or lower(coalesce(ga_name,'')) like '%advance%') and lower(coalesce(ga_type,'')) = 'liability') as prepay_flag,
          lower(coalesce(ga_sub_type,'')) = 'accountsreceivable' as ar_flag
        from raw_lines
        where ga_exclude = false
    ),
    signed_lines as (
        select
          *,
          -- normal balance signing
          case
            when lower(coalesce(ga_type,'')) in ('liability','equity','income') then
              case when lower(coalesce(posting_type,'')) = 'debit' then -abs(coalesce(amount,0)) else abs(coalesce(amount,0)) end
            else
              case when lower(coalesce(posting_type,'')) = 'debit' then abs(coalesce(amount,0)) else -abs(coalesce(amount,0)) end
          end as signed,
          -- liability-normal signing for deposits/prepay
          case
            when lower(coalesce(posting_type,'')) = 'debit' then -abs(coalesce(amount,0)) else abs(coalesce(amount,0)) end as liability_signed
        from classified
    ),
    line_totals as (
        select
          coalesce(sum(case when bank_flag then signed else 0 end),0) as bank_total,
          coalesce(sum(case when deposit_flag then liability_signed else 0 end),0) as deposit_total,
          coalesce(sum(case when prepay_flag then liability_signed else 0 end),0) as prepay_total,
          coalesce(sum(case when ar_flag then signed else 0 end),0) as ar_fallback,
          array_agg(case when deposit_flag then coalesce(transaction_id, '0')::text else null end) filter (where deposit_flag) as deposit_tx_ids,
          array_agg(case when prepay_flag then coalesce(transaction_id, '0')::text else null end) filter (where prepay_flag) as prepay_tx_ids
        from signed_lines
    ),
    payment_totals as (
      select
        coalesce(sum(abs(coalesce(t.total_amount,0))),0) as payments_total,
        coalesce(sum(abs(coalesce(t.total_amount,0))) filter (where t.id::text = any(lt.deposit_tx_ids)),0) as deposits_from_payments,
        coalesce(sum(abs(coalesce(t.total_amount,0))) filter (where t.id::text = any(lt.prepay_tx_ids)),0) as prepayments_from_payments
      from line_totals lt
      cross join public.transactions t
      join property_leases pl on (pl.id = t.lease_id or (pl.buildium_lease_id is not null and pl.buildium_lease_id = t.buildium_lease_id))
      where lower(coalesce(t.transaction_type,'')) similar to '%(payment|credit|refund|adjustment|receipt)%'
        and t.date <= p_as_of
    )
    select jsonb_build_object(
      'cash_balance',
        case
          when lt.bank_total <> 0 then lt.bank_total
          when pt.payments_total <> 0 then pt.payments_total
          when lt.ar_fallback <> 0 then lt.ar_fallback
          else coalesce((select balance from public.properties where id = p_property_id), 0)
        end,
      'security_deposits',
        case when pt.deposits_from_payments <> 0 then pt.deposits_from_payments else lt.deposit_total end,
      'prepayments',
        case when pt.prepayments_from_payments <> 0 then pt.prepayments_from_payments else lt.prepay_total end,
      'reserve', v_reserve,
      'available_balance',
        (case
          when lt.bank_total <> 0 then lt.bank_total
          when pt.payments_total <> 0 then pt.payments_total
          when lt.ar_fallback <> 0 then lt.ar_fallback
          else coalesce((select balance from public.properties where id = p_property_id), 0)
        end)
        + (case when pt.deposits_from_payments <> 0 then pt.deposits_from_payments * -1 else lt.deposit_total * -1 end)
        + (case when pt.prepayments_from_payments <> 0 then pt.prepayments_from_payments * -1 else lt.prepay_total * -1 end)
        - v_reserve,
      'as_of', p_as_of
    )
    from line_totals lt, payment_totals pt;
end;
$$;
