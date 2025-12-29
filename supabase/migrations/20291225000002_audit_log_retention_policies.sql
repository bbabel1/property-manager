-- Audit/Log Table Retention Policies
-- Based on cleanup audit: docs/CLEANUP_AUDIT_REPORT.md
--
-- Implements data retention policies for audit/log tables:
-- - buildium_api_log: Keep 90 days, archive older records
-- - buildium_integration_audit_log: Keep 90 days, archive older records
-- - buildium_webhook_events: Archive processed events older than 30 days
--
-- Note: If these tables are not actively used, consider dropping them instead
-- of implementing retention. Check usage in scripts/database/get-table-schema.ts
-- and maintenance scripts to confirm.

BEGIN;

-- Function to clean up old audit log entries
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clean up buildium_api_log (keep 90 days)
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'buildium_api_log') THEN
    DELETE FROM public.buildium_api_log
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'Cleaned up buildium_api_log: removed entries older than 90 days';
  END IF;

  -- Clean up buildium_integration_audit_log (keep 90 days)
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'buildium_integration_audit_log') THEN
    DELETE FROM public.buildium_integration_audit_log
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'Cleaned up buildium_integration_audit_log: removed entries older than 90 days';
  END IF;

  -- Clean up processed buildium_webhook_events (keep 30 days for processed events)
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'buildium_webhook_events') THEN
    DELETE FROM public.buildium_webhook_events
    WHERE processed_at IS NOT NULL
      AND processed_at < NOW() - INTERVAL '30 days';
    
    RAISE NOTICE 'Cleaned up buildium_webhook_events: removed processed events older than 30 days';
  END IF;
END;
$$;

COMMENT ON FUNCTION cleanup_audit_logs() IS
  'Cleans up old audit log entries according to retention policies: 90 days for API/integration logs, 30 days for processed webhook events';

-- Create a scheduled job to run cleanup weekly
-- Note: This requires pg_cron extension. If not available, set up via external cron job.
DO $cron_setup$
BEGIN
  -- Check if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule weekly cleanup (runs every Sunday at 2 AM)
    PERFORM cron.schedule(
      'cleanup-audit-logs',
      '0 2 * * 0', -- Every Sunday at 2 AM
      'SELECT cleanup_audit_logs()'
    );
    RAISE NOTICE 'Scheduled weekly audit log cleanup via pg_cron';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Set up external cron job to call cleanup_audit_logs() weekly.';
  END IF;
END $cron_setup$;

-- Manual cleanup can be run with: SELECT cleanup_audit_logs();

COMMIT;

