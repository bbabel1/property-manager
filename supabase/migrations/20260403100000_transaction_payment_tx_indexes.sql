-- Enforce unique payment splits per Buildium PaymentTransaction
CREATE UNIQUE INDEX IF NOT EXISTS ux_transaction_payment_transactions_tx_payment
  ON public.transaction_payment_transactions (transaction_id, buildium_payment_transaction_id)
  WHERE buildium_payment_transaction_id IS NOT NULL;

-- Support reconciliation lookups by bank GL account
CREATE INDEX IF NOT EXISTS idx_transactions_bank_gl_account_buildium_id
  ON public.transactions (bank_gl_account_buildium_id)
  WHERE bank_gl_account_buildium_id IS NOT NULL;

