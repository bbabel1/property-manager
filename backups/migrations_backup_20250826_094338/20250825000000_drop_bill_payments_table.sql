-- Migration: Drop bill_payments table
-- Date: 2025-08-25
-- Description: Completely remove bill_payments table as payments are now handled in transactions table

-- Drop all indexes first
DROP INDEX IF EXISTS "idx_bill_payments_bill";
DROP INDEX IF EXISTS "idx_bill_payments_bank";
DROP INDEX IF EXISTS "idx_bill_payments_date";
DROP INDEX IF EXISTS "idx_bill_payments_buildium_id";

-- Drop all constraints
ALTER TABLE IF EXISTS "public"."bill_payments" DROP CONSTRAINT IF EXISTS "bill_payments_bank_account_id_fkey";
ALTER TABLE IF EXISTS "public"."bill_payments" DROP CONSTRAINT IF EXISTS "bill_payments_bill_id_fkey";
ALTER TABLE IF EXISTS "public"."bill_payments" DROP CONSTRAINT IF EXISTS "bill_payments_buildium_payment_id_key";
ALTER TABLE IF EXISTS "public"."bill_payments" DROP CONSTRAINT IF EXISTS "bill_payments_pkey";

-- Drop RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."bill_payments";
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON "public"."bill_payments";
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON "public"."bill_payments";

-- Drop the table
DROP TABLE IF EXISTS "public"."bill_payments" CASCADE;

-- Add comment about the change
COMMENT ON SCHEMA public IS 'bill_payments table removed - payments now handled in transactions table with TransactionType = "Payment"';
