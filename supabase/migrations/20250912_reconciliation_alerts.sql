-- Alerts for reconciliation health
-- 1) Variance alerts: finished reconciliations with non-zero variance older than 24h
create or replace view public.v_reconciliation_variance_alerts as
with var as (
  select v.property_id, v.gl_account_id, v.as_of, v.variance
  from public.v_reconciliation_variances v
  join public.reconciliation_log rl
    on rl.property_id = v.property_id
   and rl.gl_account_id = v.gl_account_id
   and rl.statement_ending_date = v.as_of
  where coalesce(rl.is_finished, false) = true
    and coalesce(v.variance, 0) <> 0
)
select *,
  case when now() - (as_of::timestamptz) > interval '24 hours' then true else false end as over_24h
from var;

-- 2) Stale accounts: latest finished reconciliation older than 30 days (tunable at query time)
create or replace view public.v_reconciliation_stale_alerts as
select
  v.property_id,
  v.gl_account_id,
  v.last_reconciled_at,
  (now()::date - v.last_reconciled_at)::int as days_since
from public.v_latest_reconciliation_by_account v
where v.last_reconciled_at is not null
  and now()::date > (v.last_reconciled_at + 30);

-- 3) Union view
create or replace view public.v_reconciliation_alerts as
select 'variance'::text as alert_type, property_id, gl_account_id, as_of as ref_date, variance as metric
from public.v_reconciliation_variance_alerts where over_24h
union all
select 'stale'::text as alert_type, property_id, gl_account_id, last_reconciled_at as ref_date, days_since::numeric as metric
from public.v_reconciliation_stale_alerts;

