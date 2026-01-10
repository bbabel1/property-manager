-- Nightly slow-query sampling using pg_stat_statements.
-- Run manually in staging/prod (requires pg_cron and pg_stat_statements).
-- Does NOT auto-run; this script is provided for ops to apply intentionally.

-- 1) Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA extensions;

-- 2) Staging table for captured samples
CREATE SCHEMA IF NOT EXISTS admin;
CREATE TABLE IF NOT EXISTS admin.slow_query_samples (
  captured_at timestamptz DEFAULT now(),
  payload jsonb
);

-- 3) Nightly job at 03:00 UTC to store top 25 queries by total_time
SELECT cron.schedule(
  'nightly_slow_query_sampling',
  '0 3 * * *',
  $job$
    INSERT INTO admin.slow_query_samples (payload)
    SELECT jsonb_agg(row_to_json(t))
    FROM (
      SELECT
        query,
        calls,
        (total_exec_time + total_plan_time) AS total_time_ms,
        (mean_exec_time + mean_plan_time) AS mean_time_ms,
        rows
      FROM pg_stat_statements
      WHERE lower(query) LIKE 'select%' OR lower(query) LIKE 'with%'
      ORDER BY (total_exec_time + total_plan_time) DESC
      LIMIT 25
    ) t;
  $job$
);

-- 4) Optional: run once immediately to verify
-- INSERT INTO admin.slow_query_samples (payload)
-- SELECT jsonb_agg(row_to_json(t))
-- FROM (
--   SELECT query, calls, (total_exec_time + total_plan_time) AS total_time_ms, (mean_exec_time + mean_plan_time) AS mean_time_ms, rows
--   FROM pg_stat_statements
--   WHERE lower(query) LIKE 'select%' OR lower(query) LIKE 'with%'
--   ORDER BY (total_exec_time + total_plan_time) DESC
--   LIMIT 25
-- ) t;
