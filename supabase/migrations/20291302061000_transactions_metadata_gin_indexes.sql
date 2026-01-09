-- Ensure transactions.metadata exists and add GIN indexes for metadata-based lookups

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- GIN on full metadata for containment queries
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_gin
  ON public.transactions
  USING gin (metadata jsonb_path_ops);

-- GIN expression indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_charge_id_gin
  ON public.transactions
  USING gin ((metadata -> 'charge_id'));

CREATE INDEX IF NOT EXISTS idx_transactions_metadata_payment_id_gin
  ON public.transactions
  USING gin ((metadata -> 'payment_id'));

CREATE INDEX IF NOT EXISTS idx_transactions_metadata_reversal_payment_id_gin
  ON public.transactions
  USING gin ((metadata -> 'reversal_of_payment_id'));
