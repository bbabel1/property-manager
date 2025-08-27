-- Migration: Add ETF account fields to owners table

-- Create enumerated type for account type
DO $$ BEGIN
    CREATE TYPE "etf_account_type_enum" AS ENUM ('Checking', 'Saving');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add columns to owners table
ALTER TABLE "owners"
    ADD COLUMN IF NOT EXISTS "etf_account_type" "etf_account_type_enum",
    ADD COLUMN IF NOT EXISTS "etf_account_number" NUMERIC,
    ADD COLUMN IF NOT EXISTS "etf_routing_number" NUMERIC;

-- NOTE: The fields etf_account_number and etf_routing_number contain sensitive information. Consider encrypting these fields or restricting access via RLS policies for enhanced security.
