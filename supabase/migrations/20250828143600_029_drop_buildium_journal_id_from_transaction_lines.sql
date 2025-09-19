-- Migration: Drop buildium_journal_id from transaction_lines
-- Description: Field no longer needed per requirements

ALTER TABLE public.transaction_lines
  DROP COLUMN IF EXISTS buildium_journal_id;

