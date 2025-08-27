-- Migration: Update Lease Table Structure
-- Date: 2025-01-15
-- Description: Update Lease table to match Buildium API data structure

-- Add new fields to Lease table to match Buildium structure
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "unit_number" VARCHAR(50);
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "lease_type" VARCHAR(50);
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "term_type" VARCHAR(50);
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "renewal_offer_status" VARCHAR(50);
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "is_eviction_pending" BOOLEAN DEFAULT false;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "current_number_of_occupants" INTEGER;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "payment_due_day" INTEGER;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "automatically_move_out_tenants" BOOLEAN DEFAULT false;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "buildium_created_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "buildium_updated_at" TIMESTAMP WITH TIME ZONE;

-- Rename existing fields to match Buildium structure
ALTER TABLE "Lease" RENAME COLUMN "startDate" TO "lease_from_date";
ALTER TABLE "Lease" RENAME COLUMN "endDate" TO "lease_to_date";
ALTER TABLE "Lease" RENAME COLUMN "depositAmt" TO "security_deposit";
ALTER TABLE "Lease" RENAME COLUMN "notes" TO "comment";

-- Add a rent_amount field (separate from security_deposit)
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "rent_amount" NUMERIC;

-- Add comments
COMMENT ON COLUMN "Lease"."unit_number" IS 'Unit number from Buildium';
COMMENT ON COLUMN "Lease"."lease_type" IS 'Type of lease (Fixed, Month-to-Month, etc.)';
COMMENT ON COLUMN "Lease"."term_type" IS 'Term type (Standard, etc.)';
COMMENT ON COLUMN "Lease"."renewal_offer_status" IS 'Status of renewal offer';
COMMENT ON COLUMN "Lease"."is_eviction_pending" IS 'Whether eviction is pending';
COMMENT ON COLUMN "Lease"."current_number_of_occupants" IS 'Current number of occupants';
COMMENT ON COLUMN "Lease"."payment_due_day" IS 'Day of month when payment is due';
COMMENT ON COLUMN "Lease"."automatically_move_out_tenants" IS 'Whether to automatically move out tenants';
COMMENT ON COLUMN "Lease"."buildium_created_at" IS 'When the lease was created in Buildium';
COMMENT ON COLUMN "Lease"."buildium_updated_at" IS 'When the lease was last updated in Buildium';
COMMENT ON COLUMN "Lease"."rent_amount" IS 'Monthly rent amount';
