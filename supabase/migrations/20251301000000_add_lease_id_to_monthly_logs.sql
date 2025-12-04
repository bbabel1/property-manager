-- Migration: Add lease_id to monthly_logs for linking logs to specific leases
-- Adds a nullable lease_id column and supporting index/comment. The column may already exist in
-- some environments; use IF NOT EXISTS guards to keep the migration idempotent.

ALTER TABLE public.monthly_logs
  ADD COLUMN IF NOT EXISTS lease_id bigint REFERENCES public.lease(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.monthly_logs.lease_id IS
  'Optional lease reference for the monthly log; used to preselect the correct lease context when available.';

CREATE INDEX IF NOT EXISTS monthly_logs_lease_id_idx
  ON public.monthly_logs(lease_id);
