-- Ledger balance function and variance view
create or replace function public.gl_ledger_balance_as_of(
  p_property_id uuid, p_gl_account_id uuid, p_as_of date
) returns numeric language sql security invoker stable as $$
  select coalesce(sum(case when tl.posting_type='Debit' then tl.amount
                           when tl.posting_type='Credit' then -tl.amount
                           else 0 end),0)::numeric(14,2)
  from public.transaction_lines tl
  where tl.property_id = p_property_id
    and tl.gl_account_id = p_gl_account_id
    and tl.date <= p_as_of;
$$;

create or replace view public.v_reconciliation_variances as
select
  rl.property_id,
  rl.gl_account_id,
  rl.statement_ending_date as as_of,
  rl.ending_balance as buildium_ending_balance,
  public.gl_ledger_balance_as_of(rl.property_id, rl.gl_account_id, rl.statement_ending_date) as ledger_balance,
  (coalesce(rl.ending_balance,0) - public.gl_ledger_balance_as_of(rl.property_id, rl.gl_account_id, rl.statement_ending_date))::numeric(14,2) as variance
from public.reconciliation_log rl
where rl.statement_ending_date is not null;

