# Audit Log Retention Monitoring Guide

**Date**: 2025-01-31  
**Purpose**: Monitor audit log retention policies to confirm cleanup is working

---

## Overview

After setting up the external cron job for `cleanup_audit_logs()`, monitor the retention policies for one week to confirm rows are being deleted as expected.

---

## Monitoring Queries

### Daily Check: Row Counts and Age Distribution

Run this query daily to track row counts and age distribution:

```sql
-- Comprehensive audit log status
WITH api_log_stats AS (
  SELECT 
    'buildium_api_log' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') AS rows_older_than_90_days,
    MIN(created_at) AS oldest_entry,
    MAX(created_at) AS newest_entry,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS rows_last_7_days
  FROM buildium_api_log
),
integration_log_stats AS (
  SELECT 
    'buildium_integration_audit_log' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') AS rows_older_than_90_days,
    MIN(created_at) AS oldest_entry,
    MAX(created_at) AS newest_entry,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS rows_last_7_days
  FROM buildium_integration_audit_log
),
webhook_stats AS (
  SELECT 
    'buildium_webhook_events' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE processed_at IS NOT NULL AND processed_at < NOW() - INTERVAL '30 days') AS processed_older_than_30_days,
    MIN(processed_at) AS oldest_processed,
    MAX(processed_at) AS newest_processed,
    COUNT(*) FILTER (WHERE processed_at IS NULL) AS unprocessed_rows,
    COUNT(*) FILTER (WHERE processed_at >= NOW() - INTERVAL '7 days') AS processed_last_7_days
  FROM buildium_webhook_events
)
SELECT * FROM api_log_stats
UNION ALL
SELECT 
  table_name,
  total_rows,
  rows_older_than_90_days AS rows_older_than_90_days,
  oldest_entry,
  newest_entry,
  rows_last_7_days
FROM integration_log_stats
UNION ALL
SELECT 
  table_name,
  total_rows,
  processed_older_than_30_days AS rows_older_than_90_days,
  oldest_processed AS oldest_entry,
  newest_processed AS newest_entry,
  processed_last_7_days AS rows_last_7_days
FROM webhook_stats
ORDER BY table_name;
```

### Weekly Check: Before/After Cleanup

Run this query **before** the cron job runs (e.g., Saturday night) and **after** (e.g., Sunday morning):

```sql
-- Snapshot before cleanup
CREATE TEMP TABLE IF NOT EXISTS audit_log_snapshot AS
SELECT 
  'buildium_api_log' AS table_name,
  COUNT(*) AS row_count,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') AS rows_to_delete,
  NOW() AS snapshot_time
FROM buildium_api_log
UNION ALL
SELECT 
  'buildium_integration_audit_log',
  COUNT(*),
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days'),
  NOW()
FROM buildium_integration_audit_log
UNION ALL
SELECT 
  'buildium_webhook_events',
  COUNT(*),
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL AND processed_at < NOW() - INTERVAL '30 days'),
  NOW()
FROM buildium_webhook_events;

-- After cleanup, compare:
SELECT 
  s.table_name,
  s.row_count AS before_count,
  s.rows_to_delete AS expected_deleted,
  s.snapshot_time,
  -- Current counts
  CASE s.table_name
    WHEN 'buildium_api_log' THEN (SELECT COUNT(*) FROM buildium_api_log)
    WHEN 'buildium_integration_audit_log' THEN (SELECT COUNT(*) FROM buildium_integration_audit_log)
    WHEN 'buildium_webhook_events' THEN (SELECT COUNT(*) FROM buildium_webhook_events)
  END AS after_count,
  s.row_count - CASE s.table_name
    WHEN 'buildium_api_log' THEN (SELECT COUNT(*) FROM buildium_api_log)
    WHEN 'buildium_integration_audit_log' THEN (SELECT COUNT(*) FROM buildium_integration_audit_log)
    WHEN 'buildium_webhook_events' THEN (SELECT COUNT(*) FROM buildium_webhook_events)
  END AS actual_deleted
FROM audit_log_snapshot s;
```

---

## Monitoring Schedule

### Week 1: Daily Monitoring

**Days 1-7**: Run the daily check query each day to establish baseline and track trends.

**Day 7 (Sunday)**: 
- Run snapshot query **before** cron job (Saturday night)
- Verify cron job runs successfully
- Run comparison query **after** cron job (Sunday morning)
- Verify rows were deleted

### Week 2+: Weekly Monitoring

**Every Sunday**: 
- Check cron job execution logs
- Run before/after comparison query
- Verify retention is working

---

## Expected Behavior

### buildium_api_log & buildium_integration_audit_log

- **Retention**: 90 days
- **Expected**: Rows older than 90 days should be deleted weekly
- **Growth Rate**: Should stabilize (new rows added, old rows removed)

### buildium_webhook_events

- **Retention**: 30 days for processed events
- **Expected**: Only processed events older than 30 days are deleted
- **Unprocessed Events**: Should remain (not deleted)
- **Growth Rate**: Should stabilize for processed events

---

## Red Flags

Watch for these issues:

1. **No rows deleted**: 
   - Cron job may not be running
   - Function may have errors
   - Check cron logs

2. **Too many rows deleted**:
   - Retention interval may be wrong
   - Check function logic

3. **Rows growing without cleanup**:
   - Cron job may have failed
   - Check execution logs

4. **Unprocessed webhook events deleted**:
   - Function logic error
   - Should only delete processed events

---

## Troubleshooting

### Check if cleanup function exists

```sql
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'cleanup_audit_logs';
```

### Test cleanup function manually

```sql
-- Check what will be deleted (dry run)
SELECT 
  'buildium_api_log' AS table_name,
  COUNT(*) AS rows_to_delete
FROM buildium_api_log
WHERE created_at < NOW() - INTERVAL '90 days'
UNION ALL
SELECT 
  'buildium_integration_audit_log',
  COUNT(*)
FROM buildium_integration_audit_log
WHERE created_at < NOW() - INTERVAL '90 days'
UNION ALL
SELECT 
  'buildium_webhook_events',
  COUNT(*)
FROM buildium_webhook_events
WHERE processed_at IS NOT NULL
  AND processed_at < NOW() - INTERVAL '30 days';

-- Run cleanup
SELECT cleanup_audit_logs();
```

### Check cron job execution

- **GitHub Actions**: Check Actions tab for workflow runs
- **Vercel Cron**: Check Vercel dashboard > Cron Jobs
- **Server Cron**: Check `/var/log/cron` or cron job logs
- **Manual Script**: Check script output logs

---

## Monitoring Dashboard Query

Create a simple monitoring view (optional):

```sql
CREATE OR REPLACE VIEW v_audit_log_retention_status AS
SELECT 
  'buildium_api_log' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') AS rows_exceeding_retention,
  MIN(created_at) AS oldest_entry,
  MAX(created_at) AS newest_entry,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400), 2) AS avg_age_days
FROM buildium_api_log
UNION ALL
SELECT 
  'buildium_integration_audit_log',
  COUNT(*),
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days'),
  MIN(created_at),
  MAX(created_at),
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400), 2)
FROM buildium_integration_audit_log
UNION ALL
SELECT 
  'buildium_webhook_events',
  COUNT(*),
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL AND processed_at < NOW() - INTERVAL '30 days'),
  MIN(processed_at),
  MAX(processed_at),
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - COALESCE(processed_at, created_at))) / 86400), 2)
FROM buildium_webhook_events;

-- Query the view
SELECT * FROM v_audit_log_retention_status;
```

---

## Success Criteria

After one week of monitoring, you should see:

- ✅ Cron job runs successfully each week
- ✅ Rows older than retention period are deleted
- ✅ Row counts stabilize (not growing unbounded)
- ✅ No errors in cleanup function execution
- ✅ Unprocessed webhook events are not deleted

---

## Logging Recommendations

If setting up a script-based cron job, ensure it logs:

1. **Execution time**: When cleanup ran
2. **Rows deleted**: How many rows were removed from each table
3. **Errors**: Any errors encountered
4. **Duration**: How long cleanup took

Example log format:
```
[2025-02-02 02:00:00] Audit log cleanup started
[2025-02-02 02:00:01] buildium_api_log: deleted 1,234 rows
[2025-02-02 02:00:02] buildium_integration_audit_log: deleted 567 rows
[2025-02-02 02:00:03] buildium_webhook_events: deleted 890 rows
[2025-02-02 02:00:03] Audit log cleanup completed in 3.2s
```

---

**Last Updated**: 2025-01-31  
**Next Review**: After first week of monitoring

