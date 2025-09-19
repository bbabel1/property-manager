-- Migration: Add buildium_unit_id to lease table
-- Description: Add buildium_unit_id field to lease table for direct unit reference

-- Add buildium_unit_id column to lease table
ALTER TABLE "public"."lease" 
ADD COLUMN "buildium_unit_id" integer;

-- Add comment to the new column
COMMENT ON COLUMN "public"."lease"."buildium_unit_id" IS 'Direct reference to Buildium unit ID for this lease';

-- Create index for better query performance
CREATE INDEX "idx_lease_buildium_unit_id" ON "public"."lease" USING "btree" ("buildium_unit_id");

-- Add comment to the index
COMMENT ON INDEX "public"."idx_lease_buildium_unit_id" IS 'Index on buildium_unit_id for efficient lease queries by unit';
