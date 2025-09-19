-- Migration: Add buildium_property_id to lease table
-- Description: Add buildium_property_id field to lease table for direct property reference

-- Add buildium_property_id column to lease table
ALTER TABLE "public"."lease" 
ADD COLUMN "buildium_property_id" integer;

-- Add comment to the new column
COMMENT ON COLUMN "public"."lease"."buildium_property_id" IS 'Direct reference to Buildium property ID for this lease';

-- Create index for better query performance
CREATE INDEX "idx_lease_buildium_property_id" ON "public"."lease" USING "btree" ("buildium_property_id");

-- Add comment to the index
COMMENT ON INDEX "public"."idx_lease_buildium_property_id" IS 'Index on buildium_property_id for efficient lease queries by property';
