-- Migration: Add balance fields to bank_accounts table
-- Description: Adds balance and buildium_balance numeric fields to track account balances

-- Add balance column to bank_accounts table
ALTER TABLE "public"."bank_accounts" 
ADD COLUMN "balance" numeric(15,2) DEFAULT 0.00;

-- Add buildium_balance column to bank_accounts table
ALTER TABLE "public"."bank_accounts" 
ADD COLUMN "buildium_balance" numeric(15,2) DEFAULT 0.00;

-- Add comments for the new columns
COMMENT ON COLUMN "public"."bank_accounts"."balance" IS 'Current balance of the bank account in local system';
COMMENT ON COLUMN "public"."bank_accounts"."buildium_balance" IS 'Current balance of the bank account from Buildium API';

-- Update existing records to have zero balance by default
UPDATE "public"."bank_accounts" 
SET "balance" = 0.00, "buildium_balance" = 0.00 
WHERE "balance" IS NULL OR "buildium_balance" IS NULL;
