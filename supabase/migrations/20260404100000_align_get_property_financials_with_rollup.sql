-- Align get_property_financials with shared rollup logic (bank/payment/deposit/prepay)
-- - Avoid double-counting deposits from payment_lines
-- - Prefer bank lines unless they look incomplete; fallback to payments, then A/R
-- - Use payment-like transactions (header amounts) for deposit/prepay fallbacks

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
    v_result jsonb;
    v_operating_bank_gl_account_id uuid;
begin
    select
      coalesce(reserve, 0),
      coalesce(cash_balance, 0),
      operating_bank_gl_account_id
    into v_reserve, v_balance, v_operating_bank_gl_account_id
    from public.properties
    where id = p_property_id;

    v_deposits := 0;
    v_prepay := 0;

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
            or (
              v_operating_bank_gl_account_id IS NOT NULL AND tl.gl_account_id = v_operating_bank_gl_account_id
            )
          )
    ),
    classified as (
        select
          rl.id,
          rl.gl_account_id,
          rl.transaction_id,
          rl.amount,
          rl.posting_type,
          rl.ga_type,
          rl.ga_sub_type,
          rl.ga_name,
          rl.ga_is_bank,
          rl.ga_is_sdl,
          rl.ga_exclude,
          case
            when regexp_replace(lower(coalesce(rl.ga_sub_type,'')), '[\\s_-]+', '', 'g') like '%accountsreceivable%'
                 or regexp_replace(lower(coalesce(rl.ga_name,'')), '[\\s_-]+', '', 'g') like '%accountsreceivable%' then false
            when v_operating_bank_gl_account_id is not null and rl.gl_account_id = v_operating_bank_gl_account_id then true
            else false
          end as bank_flag,
          (rl.ga_is_sdl = true
            or (lower(coalesce(rl.ga_sub_type,'')) like '%deposit%' and lower(coalesce(rl.ga_type,'')) = 'liability')
            or lower(coalesce(rl.ga_name,'')) like '%deposit%') as deposit_flag,
          ((lower(coalesce(rl.ga_sub_type,'')) like '%prepay%'
             or lower(coalesce(rl.ga_sub_type,'')) like '%prepaid%'
             or lower(coalesce(rl.ga_sub_type,'')) like '%advance%'
             or lower(coalesce(rl.ga_name,'')) like '%prepay%'
             or lower(coalesce(rl.ga_name,'')) like '%advance%')
            and lower(coalesce(rl.ga_type,'')) = 'liability') as prepay_flag,
          case
            when regexp_replace(lower(coalesce(rl.ga_sub_type,'')), '[\\s_-]+', '', 'g') = 'accountsreceivable'
              or regexp_replace(lower(coalesce(rl.ga_name,'')), '[\\s_-]+', '', 'g') like '%accountsreceivable%' then true
            else false
          end as ar_flag
        from raw_lines rl
        where rl.ga_exclude = false
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
          coalesce(sum(case when bank_flag and lower(coalesce(posting_type,'')) = 'debit' then abs(coalesce(amount,0)) else 0 end),0) - 
          coalesce(sum(case when bank_flag and lower(coalesce(posting_type,'')) = 'credit' then abs(coalesce(amount,0)) else 0 end),0) as bank_total_simple,
          count(case when bank_flag then 1 end) as bank_line_count,
          coalesce(sum(case when bank_flag and lower(coalesce(posting_type,'')) = 'debit' then abs(coalesce(amount,0)) else 0 end),0) as bank_debits_total,
          coalesce(sum(case when bank_flag and lower(coalesce(posting_type,'')) = 'credit' then abs(coalesce(amount,0)) else 0 end),0) as bank_credits_total,
          array_remove(array_agg(case when deposit_flag and transaction_id is not null then transaction_id::text else null end), null) as deposit_tx_ids,
          array_remove(array_agg(case when prepay_flag and transaction_id is not null then transaction_id::text else null end), null) as prepay_tx_ids
        from signed_lines
    ),
    payment_tx as (
      select
        coalesce(
          sum(abs(coalesce(t.total_amount,0)))
            filter (where lower(coalesce(t.transaction_type::text,'')) similar to '%(payment|credit|refund|adjustment|receipt)%'),
          0
        ) as payments_total,
        array_remove(array_agg(t.id::text), null) as payment_tx_ids
      from public.transactions t
      where (
        t.lease_id in (select id from property_leases)
        or t.buildium_lease_id in (select buildium_lease_id from property_leases where buildium_lease_id is not null)
      )
        and t.date <= p_as_of
    ),
    deposit_from_payments as (
      select coalesce(
        sum(abs(coalesce(t.total_amount,0)))
          filter (
            where lower(coalesce(t.transaction_type::text,'')) similar to '%(payment|credit|refund|adjustment|receipt)%'
              and t.id::text = any(lt.deposit_tx_ids)
          ), 0
      ) as deposits_from_payments,
      coalesce(
        sum(abs(coalesce(t.total_amount,0)))
          filter (
            where lower(coalesce(t.transaction_type::text,'')) similar to '%(payment|credit|refund|adjustment|receipt)%'
              and t.id::text = any(lt.prepay_tx_ids)
          ), 0
      ) as prepayments_from_payments
      from line_totals lt
      cross join public.transactions t
      where t.id::text = any(lt.deposit_tx_ids || lt.prepay_tx_ids)
        and t.date <= p_as_of
    ),
    rolled as (
      select
        case
          when lt.bank_line_count > 0
            and not (lt.bank_line_count > 0 and abs(pt.payments_total) > 0 and abs(lt.bank_total) < abs(pt.payments_total) / 10)
            then lt.bank_total
          when pt.payments_total <> 0 then pt.payments_total
          when lt.ar_fallback <> 0 then lt.ar_fallback
          else v_balance
        end as cash_balance_raw,
        case
          when dfp.deposits_from_payments <> 0 then dfp.deposits_from_payments
          when lt.deposit_total <> 0 then lt.deposit_total
          else v_deposits
        end as deposits_raw,
        case
          when dfp.prepayments_from_payments <> 0 then dfp.prepayments_from_payments
          when lt.prepay_total <> 0 then lt.prepay_total
          else v_prepay
        end as prepayments_raw,
        lt.bank_total as bank_total_complex,
        lt.bank_total_simple as bank_total_simple,
        pt.payments_total as payments_total_val,
        lt.ar_fallback as ar_fallback_val,
        lt.bank_line_count as bank_line_count,
        lt.bank_debits_total as bank_debits_total,
        lt.bank_credits_total as bank_credits_total,
        (lt.bank_line_count > 0 and abs(pt.payments_total) > 0 and abs(lt.bank_total) < abs(pt.payments_total) / 10) as incomplete_bank_lines_flag
      from line_totals lt
      cross join payment_tx pt
      cross join deposit_from_payments dfp
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
      'as_of', p_as_of,
      '_debug'::text, jsonb_build_object(
        'bank_total_complex', r.bank_total_complex,
        'bank_total_simple', r.bank_total_simple,
        'payments_total', r.payments_total_val,
        'ar_fallback', r.ar_fallback_val,
        'used_fallback', v_balance,
        'bank_line_count', r.bank_line_count,
        'bank_debits_total', r.bank_debits_total,
        'bank_credits_total', r.bank_credits_total,
        'incomplete_bank_lines_flag', r.incomplete_bank_lines_flag
      )
    )
    into v_result
    from rolled r;
    
    return v_result;
end;
$$;

comment on function public.get_property_financials(uuid, date) is 
'Returns property financials with cash balance calculated from bank GL transaction_lines; aligns with rollup logic (bank preferred unless incomplete, then payments, then A/R) and avoids double-counting deposits from payment lines.';
