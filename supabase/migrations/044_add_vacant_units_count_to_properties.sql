-- Migration: Add vacant_units_count column to properties table
-- Description: Adds a computed column that tracks the count of units with status 'Vacant' for each property
-- Date: 2025-01-15

-- Add the vacant_units_count column to properties table
ALTER TABLE "public"."properties" 
ADD COLUMN "vacant_units_count" integer DEFAULT 0 NOT NULL;

-- Add comment explaining the column purpose
COMMENT ON COLUMN "public"."properties"."vacant_units_count" IS 'Count of units with status = Vacant for this property. Automatically maintained by triggers.';

-- Create function to update vacant_units_count for a property
CREATE OR REPLACE FUNCTION "public"."update_property_vacant_units_count"()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle both INSERT and UPDATE operations
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update the property's vacant_units_count
        UPDATE "public"."properties" 
        SET "vacant_units_count" = (
            SELECT COUNT(*) 
            FROM "public"."units" 
            WHERE "property_id" = COALESCE(NEW."property_id", OLD."property_id")
            AND "status" = 'Vacant'
            AND "is_active" = true
        )
        WHERE "id" = COALESCE(NEW."property_id", OLD."property_id");
        
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Handle DELETE operation
    IF TG_OP = 'DELETE' THEN
        -- Update the property's vacant_units_count
        UPDATE "public"."properties" 
        SET "vacant_units_count" = (
            SELECT COUNT(*) 
            FROM "public"."units" 
            WHERE "property_id" = OLD."property_id"
            AND "status" = 'Vacant'
            AND "is_active" = true
        )
        WHERE "id" = OLD."property_id";
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update vacant_units_count when units are modified
CREATE TRIGGER "trigger_update_property_vacant_units_count"
    AFTER INSERT OR UPDATE OR DELETE ON "public"."units"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_property_vacant_units_count"();

-- Create function to update vacant_units_count for all properties (for initial population)
CREATE OR REPLACE FUNCTION "public"."populate_all_property_vacant_units_count"()
RETURNS void AS $$
BEGIN
    UPDATE "public"."properties" 
    SET "vacant_units_count" = (
        SELECT COUNT(*) 
        FROM "public"."units" 
        WHERE "units"."property_id" = "properties"."id"
        AND "units"."status" = 'Vacant'
        AND "units"."is_active" = true
    );
END;
$$ LANGUAGE plpgsql;

-- Populate vacant_units_count for all existing properties
SELECT "public"."populate_all_property_vacant_units_count"();

-- Add index on vacant_units_count for performance (optional but recommended for queries)
CREATE INDEX IF NOT EXISTS "idx_properties_vacant_units_count" 
ON "public"."properties" ("vacant_units_count");

-- Add constraint to ensure vacant_units_count is never negative
ALTER TABLE "public"."properties" 
ADD CONSTRAINT "check_vacant_units_count_non_negative" 
CHECK ("vacant_units_count" >= 0);

-- Add constraint to ensure vacant_units_count doesn't exceed total_units
ALTER TABLE "public"."properties" 
ADD CONSTRAINT "check_vacant_units_count_not_exceed_total" 
CHECK ("vacant_units_count" <= "total_units");
