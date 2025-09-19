-- Latest finished reconciliation by account
create or replace view public.v_latest_reconciliation_by_account as
select
  property_id,
  gl_account_id,
  max(statement_ending_date) as last_reconciled_at
from public.reconciliation_log
where is_finished = true
group by property_id, gl_account_id;

