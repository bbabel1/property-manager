-- Materialize slow query samples into a readable view.
-- Run this in staging/prod after the sampling job exists.

CREATE SCHEMA IF NOT EXISTS admin;

-- View flattens the jsonb payload into rows
CREATE OR REPLACE VIEW admin.v_slow_query_samples AS
SELECT
  s.captured_at,
  q.elem ->> 'query' AS query,
  (q.elem ->> 'calls')::bigint AS calls,
  (q.elem ->> 'total_time_ms')::numeric AS total_time_ms,
  (q.elem ->> 'mean_time_ms')::numeric AS mean_time_ms,
  (q.elem ->> 'rows')::bigint AS rows_read
FROM admin.slow_query_samples s
CROSS JOIN LATERAL jsonb_array_elements(s.payload) AS q(elem);

-- Convenience view for the latest capture only
CREATE OR REPLACE VIEW admin.v_slow_query_latest AS
SELECT *
FROM admin.v_slow_query_samples
WHERE captured_at = (SELECT max(captured_at) FROM admin.slow_query_samples)
ORDER BY total_time_ms DESC;
