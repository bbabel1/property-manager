-- Query observability views backed by pg_stat_statements and pg_stat_* stats.
-- Run this in non-production first (e.g. staging), then production once verified.
-- Requires:
--   - pg_stat_statements extension
--   - Access to pg_stat_user_tables / pg_stat_user_indexes

-- 1) Ensure extension and admin schema exist
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS admin;

-- 2) Top queries by total time (heaviest overall)
CREATE OR REPLACE VIEW admin.v_pg_stat_top_queries AS
SELECT
  query,
  calls,
  (total_exec_time + total_plan_time) AS total_time_ms,
  ROUND((total_exec_time + total_plan_time) / GREATEST(calls, 1), 3) AS mean_time_ms,
  rows,
  (rows / GREATEST(calls, 1)) AS rows_per_call
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_time_ms DESC
LIMIT 100;

-- 3) Slowest queries by average time (with a minimum call count)
CREATE OR REPLACE VIEW admin.v_pg_stat_slow_queries AS
SELECT
  query,
  calls,
  (total_exec_time + total_plan_time) AS total_time_ms,
  ROUND((total_exec_time + total_plan_time) / GREATEST(calls, 1), 3) AS mean_time_ms,
  rows
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND calls >= 5
ORDER BY mean_time_ms DESC
LIMIT 100;

-- 4) Most-called RPC functions (parsed from SELECT * FROM schema.fn(...) calls)
CREATE OR REPLACE VIEW admin.v_pg_stat_rpc_functions AS
WITH parsed AS (
  SELECT
    (regexp_match(
      lower(query),
      'select\\s+\\*\\s+from\\s+([a-z0-9_\\.]+)\\s*\\('
    ))[1] AS function_name,
    calls,
    total_exec_time,
    total_plan_time,
    rows
  FROM pg_stat_statements
  WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    AND lower(query) LIKE 'select %from %(%'
)
SELECT
  function_name,
  SUM(calls) AS calls,
  SUM(total_exec_time + total_plan_time) AS total_time_ms,
  ROUND(SUM(total_exec_time + total_plan_time) / GREATEST(SUM(calls), 1), 3) AS mean_time_ms,
  SUM(rows) AS rows
FROM parsed
WHERE function_name IS NOT NULL
GROUP BY function_name
ORDER BY calls DESC, total_time_ms DESC;

-- 5) Tables with highest sequential scan counts
CREATE OR REPLACE VIEW admin.v_table_seq_scans AS
SELECT
  schemaname,
  relname AS table_name,
  seq_scan,
  idx_scan,
  n_live_tup,
  n_dead_tup,
  (seq_scan + idx_scan) AS total_scans,
  CASE
    WHEN (seq_scan + idx_scan) = 0 THEN NULL
    ELSE ROUND(100.0 * seq_scan / (seq_scan + idx_scan), 2)
  END AS seq_scan_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;

-- 6) Unused non-unique indexes (never scanned since stats reset)
CREATE OR REPLACE VIEW admin.v_unused_indexes AS
SELECT
  s.schemaname,
  s.relname AS table_name,
  s.indexrelname AS index_name,
  s.idx_scan,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
  pg_relation_size(s.indexrelid) AS index_size_bytes
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.schemaname = 'public'
  AND s.idx_scan = 0
  AND i.indisunique = FALSE
ORDER BY pg_relation_size(s.indexrelid) DESC;

