-- Add monthly_log foreign key to transaction_lines table
-- This allows transaction lines to be associated with specific monthly logs
ALTER TABLE transaction_lines
ADD COLUMN monthly_log_id UUID REFERENCES monthly_logs(id) ON DELETE
SET NULL;
-- Add index for performance
CREATE INDEX idx_transaction_lines_monthly_log_id ON transaction_lines(monthly_log_id);
-- Add comment for documentation
COMMENT ON COLUMN transaction_lines.monthly_log_id IS 'Foreign key reference to monthly_logs table. Allows transaction lines to be associated with specific monthly logs for tracking and reporting purposes.';
