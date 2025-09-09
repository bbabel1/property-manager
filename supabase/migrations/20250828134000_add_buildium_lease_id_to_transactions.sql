-- Migration: Add buildium_lease_id to transactions table
-- Description: Adds a nullable integer column `buildium_lease_id` to `public.transactions`
--              with an index for efficient lookups. Safe to run multiple times.

-- Add column if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'transactions' 
      AND column_name = 'buildium_lease_id'
  ) THEN
    ALTER TABLE public.transactions 
      ADD COLUMN buildium_lease_id integer;
  END IF;
END $$;

-- Add comment (will succeed if column exists)
COMMENT ON COLUMN public.transactions.buildium_lease_id IS 'Direct reference to Buildium lease ID for this transaction';

-- Create index for faster queries by Buildium lease
CREATE INDEX IF NOT EXISTS idx_transactions_buildium_lease_id 
  ON public.transactions USING btree (buildium_lease_id);

