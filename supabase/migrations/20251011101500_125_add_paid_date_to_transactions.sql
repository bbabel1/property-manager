-- Migration: Ensure transactions include due and paid dates from Buildium
-- Adds paid_date and ensures due_date column exists for Buildium bill metadata

BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS due_date date;

COMMENT ON COLUMN public.transactions.due_date IS 'Due date for the transaction when provided by Buildium';

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paid_date date;

COMMENT ON COLUMN public.transactions.paid_date IS 'Date the transaction was paid according to Buildium';

COMMIT;
