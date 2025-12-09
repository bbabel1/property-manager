-- Unify transaction total enforcement to signed calculator
-- Drops legacy "sum of lines" triggers/functions and recomputes totals via fn_calculate_transaction_total

begin;

-- Drop legacy constraint triggers/functions if present
drop trigger if exists trg_transaction_total_matches on public.transactions;
drop trigger if exists trg_transaction_total_lines_insupd on public.transaction_lines;
drop function if exists public.fn_transaction_total_matches_on_lines() cascade;
drop function if exists public.fn_transaction_total_matches() cascade;

-- Recalculate header totals using the signed calculator
with targets as (
  select id
  from public.transactions
)
update public.transactions t
set total_amount = public.fn_calculate_transaction_total(t.id)
from targets
where targets.id = t.id;

-- Normalize any NULL totals to zero
update public.transactions
set total_amount = 0
where total_amount is null;

-- Validation: ensure all posting_type values are canonical and amounts are non-negative
do $$
declare v_bad integer;
begin
  select count(*) into v_bad
  from public.transaction_lines
  where coalesce(posting_type, '') not in ('Debit','Credit')
     or amount < 0;
  if v_bad > 0 then
    raise exception 'Found % transaction_lines with non-canonical posting_type or negative amount after cleanup', v_bad
      using errcode = '23514';
  end if;
end$$;

commit;
