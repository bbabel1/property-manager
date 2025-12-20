-- Fix get_property_financials to avoid enum casting errors and align sign handling
-- - Cast transaction_type to text before COALESCE to prevent ""::transaction_type_enum errors
-- - Normalize deposit/prepayment liabilities so available_balance matches app rollup

create or replace function public.get_property_financials(
    p_property_id uuid,
    p_as_of date default current_date
) returns jsonb
language plpgsql
stable
as $$
declare
    v_reserve numeric := 0;
    v_balance numeric := 0;
    v_deposits numeric := 0;
    v_prepay numeric := 0;
begin
    select
      coalesce(reserve, 0),
      coalesce(balance, 0),
      coalesce(deposits_held_balance, 0),
      coalesce(prepayments_balance, 0)
    into v_reserve, v_balance, v_deposits, v_prepay
    from public.properties
    where id = p_property_id;

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
            or tl.buildium_lease_id in (
              select buildium_lease_id from property_leases where buildium_lease_id is not null
            )
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
          (ga_is_bank = true
            or lower(coalesce(ga_sub_type,'')) like '%cash%'
            or lower(coalesce(ga_name,'')) ~ '(bank|checking|operating|trust)'
            or lower(coalesce(ga_type,'')) = 'asset') as bank_flag,
          (ga_is_sdl = true
            or (lower(coalesce(ga_sub_type,'')) like '%deposit%' and lower(coalesce(ga_type,'')) = 'liability')
            or lower(coalesce(ga_name,'')) like '%deposit%') as deposit_flag,
          ((lower(coalesce(ga_sub_type,'')) like '%prepay%'
             or lower(coalesce(ga_sub_type,'')) like '%prepaid%'
             or lower(coalesce(ga_sub_type,'')) like '%advance%'
             or lower(coalesce(ga_name,'')) like '%prepay%'
             or lower(coalesce(ga_name,'')) like '%advance%')
            and lower(coalesce(ga_type,'')) = 'liability') as prepay_flag,
          lower(coalesce(ga_sub_type,'')) = 'accountsreceivable' as ar_flag
        from raw_lines
        where ga_exclude = false
    ),
    signed_lines as (
        select
          *,
          case
            when lower(coalesce(ga_type,'')) in ('liability','equity','income') then
              case when lower(coalesce(posting_type,'')) = 'debit' then -abs(coalesce(amount,0)) else abs(coalesce(amount,0)) end
            else
              case when lower(coalesce(posting_type,'')) = 'debit' then abs(coalesce(amount,0)) else -abs(coalesce(amount,0)) end
          end as signed,
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
          array_remove(array_agg(case when deposit_flag and transaction_id is not null then transaction_id::text else null end), null) as deposit_tx_ids,
          array_remove(array_agg(case when prepay_flag and transaction_id is not null then transaction_id::text else null end), null) as prepay_tx_ids
        from signed_lines
    ),
    payment_lines as (
      select transaction_id::text as tx_id, sum(abs(coalesce(amount,0))) as total
      from signed_lines
      where transaction_id is not null
      group by transaction_id
    ),
    payment_tx as (
      select coalesce(
        sum(abs(coalesce(t.total_amount,0)))
          filter (where lower(coalesce(t.transaction_type::text,'')) similar to '%(payment|credit|refund|adjustment|receipt)%'),
        0
      ) as payments_total
      from public.transactions t
      where (
        t.lease_id in (select id from property_leases)
        or t.buildium_lease_id in (select buildium_lease_id from property_leases where buildium_lease_id is not null)
      )
        and t.date <= p_as_of
    ),
    payment_totals as (
      select
        case when pt.payments_total <> 0 then pt.payments_total else coalesce(plsum.total,0) end as payments_total,
        coalesce(pldep.total,0) as deposits_from_payments,
        coalesce(plpre.total,0) as prepayments_from_payments
      from payment_tx pt
      left join (
        select sum(total) as total from payment_lines where tx_id in (select unnest(deposit_tx_ids) from line_totals)
      ) pldep on true
      left join (
        select sum(total) as total from payment_lines where tx_id in (select unnest(prepay_tx_ids) from line_totals)
      ) plpre on true
      left join (
        select sum(total) as total from payment_lines
      ) plsum on true
    ),
    rolled as (
      select
        case
          when lt.bank_total <> 0 then lt.bank_total
          when pt.payments_total <> 0 then pt.payments_total
          when lt.ar_fallback <> 0 then lt.ar_fallback
          else v_balance
        end as cash_balance_raw,
        case
          when pt.deposits_from_payments <> 0 then pt.deposits_from_payments
          when lt.deposit_total <> 0 then lt.deposit_total
          else v_deposits
        end as deposits_raw,
        case
          when pt.prepayments_from_payments <> 0 then pt.prepayments_from_payments
          when lt.prepay_total <> 0 then lt.prepay_total
          else v_prepay
        end as prepayments_raw
      from line_totals lt, payment_totals pt
    )
    select jsonb_build_object(
      'cash_balance', r.cash_balance_raw,
      'security_deposits',
        (case when r.deposits_raw > 0 then -r.deposits_raw else r.deposits_raw end)
        + (case when r.prepayments_raw > 0 then -r.prepayments_raw else r.prepayments_raw end),
      'prepayments', r.prepayments_raw,
      'reserve', v_reserve,
      'available_balance',
        r.cash_balance_raw
        + (case when r.deposits_raw > 0 then -r.deposits_raw else r.deposits_raw end)
        + (case when r.prepayments_raw > 0 then -r.prepayments_raw else r.prepayments_raw end)
        - v_reserve,
      'as_of', p_as_of
    )
    from rolled r;
end;
$$;
