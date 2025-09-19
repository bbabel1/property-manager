-- Migration: Add gl_account relationship to bank_accounts table
-- Description: Adds a foreign key relationship from bank_accounts to gl_accounts table
-- Relationship: One gl_account can be associated with many bank_accounts (one-to-many)

-- Add gl_account foreign key column to bank_accounts table
ALTER TABLE "public"."bank_accounts" 
ADD COLUMN "gl_account" uuid REFERENCES "public"."gl_accounts"("id");

-- Add comment for the new column
COMMENT ON COLUMN "public"."bank_accounts"."gl_account" IS 'Reference to the associated general ledger account';

-- Create index on the foreign key for better query performance
CREATE INDEX "idx_bank_accounts_gl_account" ON "public"."bank_accounts"("gl_account");
