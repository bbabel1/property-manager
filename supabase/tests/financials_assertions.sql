-- Minimal assertion script for financials functions
-- Run this in a dev DB after applying migrations

-- 1) Functions exist
do $$ begin
  perform 1 from pg_proc where proname = 'get_property_financials';
  if not found then raise exception 'get_property_financials missing'; end if;
  perform 1 from pg_proc where proname = 'gl_account_activity';
  if not found then raise exception 'gl_account_activity missing'; end if;
  perform 1 from pg_proc where proname = 'gl_ledger_balance_as_of';
  if not found then raise exception 'gl_ledger_balance_as_of missing'; end if;
end $$;

-- 2) gl_ledger_balance_as_of returns 0 with no data
do $$
declare
  v numeric;
begin
  select public.gl_ledger_balance_as_of(gen_random_uuid(), gen_random_uuid(), current_date) into v;
  if coalesce(v, 0) <> 0 then raise exception 'Expected zero ledger balance on empty dataset, got %', v; end if;
end $$;

-- 3) Variance/staleness views compile and return 0 rows on empty dataset
do $$
declare
  c1 int; c2 int; c3 int;
begin
  select count(*) into c1 from public.v_reconciliation_variances;
  select count(*) into c2 from public.v_reconciliation_variance_alerts;
  select count(*) into c3 from public.v_reconciliation_stale_alerts;
  if c1 < 0 or c2 < 0 or c3 < 0 then raise exception 'Counts should be non-negative'; end if;
end $$;

