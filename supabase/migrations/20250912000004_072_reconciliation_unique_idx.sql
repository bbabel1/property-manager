-- Prevent duplicate reconciliations per property+GL+statement date
create unique index if not exists rl_prop_gl_asof_uidx
on public.reconciliation_log (property_id, gl_account_id, statement_ending_date)
where statement_ending_date is not null;

