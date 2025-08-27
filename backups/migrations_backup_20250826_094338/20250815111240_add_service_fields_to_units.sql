-- Migration: Add service-related fields and enums to units table

-- Create enumerated types
DO $$ BEGIN
    CREATE TYPE "ServicePlan" AS ENUM ('Full', 'Basic', 'A-la-carte');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "FeeFrequency" AS ENUM ('Monthly', 'Annually');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "FeeType" AS ENUM ('Percentage', 'Flat Rate');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add columns to units table
ALTER TABLE "units"
    ADD COLUMN IF NOT EXISTS "service_start" DATE,
    ADD COLUMN IF NOT EXISTS "service_end" DATE,
    ADD COLUMN IF NOT EXISTS "service_plan" "ServicePlan",
    ADD COLUMN IF NOT EXISTS "fee_type" "FeeType",
    ADD COLUMN IF NOT EXISTS "fee_percent" NUMERIC,
    ADD COLUMN IF NOT EXISTS "management_fee" NUMERIC,
    ADD COLUMN IF NOT EXISTS "fee_frequency" "FeeFrequency",
    ADD COLUMN IF NOT EXISTS "active_services" TEXT,
    ADD COLUMN IF NOT EXISTS "fee_notes" TEXT;
