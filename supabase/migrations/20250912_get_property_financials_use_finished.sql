-- Include last reconciled date from finished reconciliations
create or replace function public.get_property_financials(
  p_property_id uuid,
  p_as_of date default current_date
) returns jsonb
language sql security invoker stable
as $$
with
cash as (
  select coalesce(
    sum(case when tl.posting_type = 'Debit' then tl.amount else 0 end)
    - sum(case when tl.posting_type = 'Credit' then tl.amount else 0 end), 0
  )::numeric(14,2) as amount
  from public.transaction_lines tl
  join public.gl_accounts ga on ga.id = tl.gl_account_id
  where tl.property_id = p_property_id
    and tl.date <= p_as_of
    and ga.is_bank_account = true
    and coalesce(ga.exclude_from_cash_balances, false) = false
),
deposits_liability as (
  select coalesce(
    sum(case when tl.posting_type = 'Credit' then tl.amount else 0 end)
    - sum(case when tl.posting_type = 'Debit' then tl.amount else 0 end), 0
  )::numeric(14,2) as amount
  from public.transaction_lines tl
  join public.gl_accounts ga on ga.id = tl.gl_account_id
  where tl.property_id = p_property_id
    and tl.date <= p_as_of
    and coalesce(ga.is_security_deposit_liability, false) = true
),
prop as (
  select coalesce(p.reserve, 0)::numeric(14,2) as reserve
  from public.properties p
  where p.id = p_property_id
),
finished_recon as (
  select max(rl.statement_ending_date) as last_reconciled_at
  from public.reconciliation_log rl
  join public.gl_accounts ga on ga.id = rl.gl_account_id
  where rl.property_id = p_property_id
    and ga.is_bank_account = true
    and coalesce(ga.exclude_from_cash_balances, false) = false
    and coalesce(rl.is_finished, false) = true
),
agg as (
  select
    cash.amount               as cash_balance,
    deposits_liability.amount as security_deposits,
    prop.reserve              as reserve,
    (select last_reconciled_at from finished_recon)
  from cash, deposits_liability, prop
),
out as (
  select
    p_as_of                                     as as_of,
    a.cash_balance,
    a.security_deposits,
    a.reserve,
    (a.cash_balance - a.security_deposits - a.reserve)::numeric(14,2) as available_balance,
    (select last_reconciled_at from finished_recon) as last_reconciled_at
  from agg a
)
select to_jsonb(out.*) from out;
$$;

