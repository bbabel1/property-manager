-- Additional performance indexes
-- 1) Properties: operating bank account lookup (used in reconciliation mapping)
CREATE INDEX IF NOT EXISTS idx_properties_operating_bank_account_id
  ON public.properties(operating_bank_account_id);

-- 2) Transactions by property and date (for financial period queries)
-- Skipped: current schema does not include transactions.property_id; add this index
-- if/when a property_id column is introduced.
-- CREATE INDEX IF NOT EXISTS idx_transactions_property_date
  --   ON public.transactions(property_id, "Date");

-- 3) Transaction lines by property and date (for financial period queries)
CREATE INDEX IF NOT EXISTS idx_tx_lines_property_date
  ON public.transaction_lines(property_id, date);
