-- Fix monthly_log_id foreign key location
-- Remove from transaction_lines and add to transactions table
-- Remove the monthly_log_id column from transaction_lines
ALTER TABLE transaction_lines DROP COLUMN IF EXISTS monthly_log_id;
-- Add monthly_log_id column to transactions table
ALTER TABLE transactions
ADD COLUMN monthly_log_id UUID REFERENCES monthly_logs(id) ON DELETE
SET NULL;
-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_monthly_log_id ON transactions(monthly_log_id);
-- Add comment for documentation
COMMENT ON COLUMN transactions.monthly_log_id IS 'Foreign key reference to monthly_logs table. Allows transactions to be associated with specific monthly logs for tracking and reporting purposes.';
