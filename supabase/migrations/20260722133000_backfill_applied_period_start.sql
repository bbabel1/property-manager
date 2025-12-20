-- Backfill applied_period_start on transaction_lines from monthly_logs period_start where missing

BEGIN;

UPDATE public.transaction_lines tl
SET applied_period_start = ml.period_start
FROM public.transactions t
JOIN public.monthly_logs ml ON ml.id = t.monthly_log_id
WHERE tl.transaction_id = t.id
  AND tl.applied_period_start IS NULL
  AND ml.period_start IS NOT NULL;

COMMIT;
