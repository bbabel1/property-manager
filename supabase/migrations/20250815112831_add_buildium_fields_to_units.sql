-- Migration: Add buildium_unit_id and buildium_property_id to units table

ALTER TABLE "units"
    ADD COLUMN IF NOT EXISTS "buildium_unit_id" INTEGER UNIQUE,
    ADD COLUMN IF NOT EXISTS "buildium_property_id" INTEGER;

-- Note: To populate buildium_property_id from the related properties table, a separate data migration or update statement will be needed if the relationship is defined.
