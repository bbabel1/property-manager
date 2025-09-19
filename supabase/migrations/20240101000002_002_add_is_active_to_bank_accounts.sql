-- Migration: Add is_active field to bank_accounts table
-- Description: Adds an is_active boolean field to track whether bank accounts are active or inactive

-- Add is_active column to bank_accounts table
ALTER TABLE "public"."bank_accounts" 
ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;

-- Add comment for the new column
COMMENT ON COLUMN "public"."bank_accounts"."is_active" IS 'Whether the bank account is active or inactive';

-- Update existing records to be active by default
UPDATE "public"."bank_accounts" 
SET "is_active" = true 
WHERE "is_active" IS NULL;
