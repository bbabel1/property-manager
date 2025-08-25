-- Add buildium_bill_id column to transaction_lines table
ALTER TABLE "transaction_lines" ADD COLUMN IF NOT EXISTS "buildium_bill_id" INTEGER;

-- Add index for performance
CREATE INDEX IF NOT EXISTS "idx_transaction_lines_buildium_bill_id" ON "transaction_lines"("buildium_bill_id");

-- Add comment
COMMENT ON COLUMN "transaction_lines"."buildium_bill_id" IS 'Reference to Buildium bill ID for linking bill line items';

-- Update the table comment to reflect the new purpose
COMMENT ON TABLE "transaction_lines" IS 'Transaction line items representing individual GL account postings within a transaction, including bill line items';
