create or replace function public.monthly_log_transaction_bundle(p_monthly_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total_charges numeric := 0;
  total_credits numeric := 0;
  total_payments numeric := 0;
  total_bills numeric := 0;
  escrow_amount numeric := 0;
  management_fees numeric := 0;
  owner_draw numeric := 0;
  net_to_owner numeric := 0;
  balance numeric := 0;
  previous_balance numeric := 0;
  transactions jsonb := '[]'::jsonb;
begin
  with transaction_amounts as (
    select
      t.id,
      t.transaction_type,
      t.memo,
      t.date,
      t.lease_id,
      t.monthly_log_id,
      t.reference_number,
      t.created_at,
      coalesce(first_line.amount, t.total_amount) as effective_amount,
      coalesce(first_line.name, first_line.account_number) as account_name
    from public.transactions t
    left join lateral (
      select
        tl.amount,
        ga.name,
        ga.account_number
      from public.transaction_lines tl
      left join public.gl_accounts ga on ga.id = tl.gl_account_id
      where tl.transaction_id = t.id
      order by tl.created_at asc
      limit 1
    ) as first_line on true
    where t.monthly_log_id = p_monthly_log_id
  )
  select
    coalesce(sum(case when transaction_type = 'Charge' then abs(effective_amount) end), 0),
    coalesce(sum(case when transaction_type = 'Credit' then abs(effective_amount) end), 0),
    coalesce(sum(case when transaction_type = 'Payment' then abs(effective_amount) end), 0),
    coalesce(sum(case when transaction_type = 'Bill' then abs(effective_amount) end), 0)
  into
    total_charges,
    total_credits,
    total_payments,
    total_bills
  from transaction_amounts;

  owner_draw := total_payments - total_bills - escrow_amount;
  net_to_owner :=
    total_charges - total_credits + total_payments - total_bills - management_fees - escrow_amount;
  balance := total_charges - total_credits - total_payments;

  select coalesce(previous_lease_balance, 0)
    into previous_balance
  from public.monthly_logs
  where id = p_monthly_log_id;

  with transaction_amounts as (
    select
      t.id,
      t.transaction_type,
      t.memo,
      t.date,
      t.lease_id,
      t.monthly_log_id,
      t.reference_number,
      t.created_at,
      coalesce(first_line.amount, t.total_amount) as effective_amount,
      coalesce(first_line.name, first_line.account_number) as account_name
    from public.transactions t
    left join lateral (
      select
        tl.amount,
        ga.name,
        ga.account_number
      from public.transaction_lines tl
      left join public.gl_accounts ga on ga.id = tl.gl_account_id
      where tl.transaction_id = t.id
      order by tl.created_at asc
      limit 1
    ) as first_line on true
    where t.monthly_log_id = p_monthly_log_id
  )
  select coalesce(jsonb_agg(row_to_json(row)), '[]'::jsonb)
    into transactions
  from (
    select
      id,
      effective_amount as total_amount,
      memo,
      date,
      transaction_type,
      lease_id,
      monthly_log_id,
      reference_number,
      account_name
    from transaction_amounts
    order by date desc, created_at desc, id desc
  ) as row;

  return jsonb_build_object(
    'transactions', transactions,
    'summary', jsonb_build_object(
      'totalCharges', total_charges,
      'totalCredits', total_credits,
      'totalPayments', total_payments,
      'totalBills', total_bills,
      'escrowAmount', escrow_amount,
      'managementFees', management_fees,
      'ownerDraw', owner_draw,
      'netToOwner', net_to_owner,
      'balance', balance,
      'previousBalance', previous_balance
    )
  );
end;
$$;

comment on function public.monthly_log_transaction_bundle(uuid) is
'Aggregates assigned transactions and their financial summary for a monthly log in a single RPC call with journal entry support.';
