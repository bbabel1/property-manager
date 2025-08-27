-- Migration: Add Buildium Fields to Units Table
-- Date: 2025-01-15
-- Description: Add Buildium-related fields to the units table for syncing

-- Add Buildium-related fields to units table
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "buildium_unit_id" INTEGER;
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "buildium_property_id" INTEGER;
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "unit_type" VARCHAR(50);
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "buildium_created_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "buildium_updated_at" TIMESTAMP WITH TIME ZONE;

-- Add unique constraint on buildium_unit_id for upsert operations
ALTER TABLE "units" ADD CONSTRAINT "units_buildium_unit_id_unique" UNIQUE ("buildium_unit_id");

-- Add comments to explain the new fields
COMMENT ON COLUMN "units"."buildium_unit_id" IS 'Unique identifier from Buildium API';
COMMENT ON COLUMN "units"."buildium_property_id" IS 'Buildium property ID this unit belongs to';
COMMENT ON COLUMN "units"."unit_type" IS 'Type of unit from Buildium (Apartment, Condo, House, etc.)';
COMMENT ON COLUMN "units"."is_active" IS 'Whether the unit is active in Buildium';
COMMENT ON COLUMN "units"."buildium_created_at" IS 'When the unit was created in Buildium';
COMMENT ON COLUMN "units"."buildium_updated_at" IS 'When the unit was last updated in Buildium';
