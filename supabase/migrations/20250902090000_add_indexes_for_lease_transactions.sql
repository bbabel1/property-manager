-- Add indexes to speed up Lease Transaction workflows
-- Safe, idempotent creation of indexes

-- transactions(buildium_transaction_id)
CREATE INDEX IF NOT EXISTS idx_transactions_buildium_transaction_id
  ON public.transactions USING btree (buildium_transaction_id);

-- transactions(buildium_lease_id) exists in a previous migration, but ensure idempotency
CREATE INDEX IF NOT EXISTS idx_transactions_buildium_lease_id
  ON public.transactions USING btree (buildium_lease_id);

-- transaction_lines(transaction_id)
CREATE INDEX IF NOT EXISTS idx_transaction_lines_transaction_id
  ON public.transaction_lines USING btree (transaction_id);

-- Optional helpful indexes (commented; enable if you expect heavy filtering)
-- CREATE INDEX IF NOT EXISTS idx_transaction_lines_buildium_lease_id ON public.transaction_lines USING btree (buildium_lease_id);
-- CREATE INDEX IF NOT EXISTS idx_transaction_lines_gl_account_id ON public.transaction_lines USING btree (gl_account_id);

