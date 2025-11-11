-- Fix monthly_log_id column in transaction_lines table
-- This migration ensures the monthly_log_id column exists and is properly configured
-- Check if the column exists, if not add it
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'transaction_lines'
        AND column_name = 'monthly_log_id'
) THEN -- Add the monthly_log_id column
ALTER TABLE transaction_lines
ADD COLUMN monthly_log_id UUID REFERENCES monthly_logs(id) ON DELETE
SET NULL;
-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_transaction_lines_monthly_log_id ON transaction_lines(monthly_log_id);
-- Add comment for documentation
COMMENT ON COLUMN transaction_lines.monthly_log_id IS 'Foreign key reference to monthly_logs table. Allows transaction lines to be associated with specific monthly logs for tracking and reporting purposes.';
RAISE NOTICE 'Added monthly_log_id column to transaction_lines table';
ELSE RAISE NOTICE 'monthly_log_id column already exists in transaction_lines table';
END IF;
END $$;
