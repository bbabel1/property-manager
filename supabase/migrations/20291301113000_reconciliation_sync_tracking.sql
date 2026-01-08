-- Phase 5: Add reconciliation sync tracking fields
ALTER TABLE public.reconciliation_log
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_error text,
  ADD COLUMN IF NOT EXISTS unmatched_buildium_transaction_ids integer[];

COMMENT ON COLUMN public.reconciliation_log.last_synced_at IS 'Last successful reconciliation sync timestamp.';
COMMENT ON COLUMN public.reconciliation_log.last_sync_error IS 'Last reconciliation sync error message (if any).';
COMMENT ON COLUMN public.reconciliation_log.unmatched_buildium_transaction_ids IS 'Buildium transaction IDs that could not be matched to local transactions during sync.';
