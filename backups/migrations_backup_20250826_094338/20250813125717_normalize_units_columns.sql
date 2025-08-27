-- Migration: Normalize units table column names to snake_case
-- Date: 2025-01-15
-- Description: Renames columns with spaces and mixed case to lowercase snake_case

-- Rename service-related columns (only if they exist)
DO $$
BEGIN
    -- Check and rename each column only if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'Service Start') THEN
        ALTER TABLE "units" RENAME COLUMN "Service Start" TO "service_start";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'Service End') THEN
        ALTER TABLE "units" RENAME COLUMN "Service End" TO "service_end";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'Service Plan') THEN
        ALTER TABLE "units" RENAME COLUMN "Service Plan" TO "service_plan";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'Fee Type') THEN
        ALTER TABLE "units" RENAME COLUMN "Fee Type" TO "fee_type";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'Fee Percent') THEN
        ALTER TABLE "units" RENAME COLUMN "Fee Percent" TO "fee_percent";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'Management Fee') THEN
        ALTER TABLE "units" RENAME COLUMN "Management Fee" TO "management_fee";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'Fee Frequency') THEN
        ALTER TABLE "units" RENAME COLUMN "Fee Frequency" TO "fee_frequency";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'Active Services') THEN
        ALTER TABLE "units" RENAME COLUMN "Active Services" TO "active_services";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'Fee Notes') THEN
        ALTER TABLE "units" RENAME COLUMN "Fee Notes" TO "fee_notes";
    END IF;
END $$;

-- Update the trigger function to use new column names
CREATE OR REPLACE FUNCTION set_buildium_property_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-populate buildium_property_id from the related property
    -- when units table has buildium_property_id column
    -- and properties table has buildium_property_id column
    SELECT buildium_property_id INTO NEW.buildium_property_id
    FROM properties
    WHERE id = NEW.property_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_set_buildium_property_id ON units;
CREATE TRIGGER trg_set_buildium_property_id
    BEFORE INSERT OR UPDATE ON units
    FOR EACH ROW
    EXECUTE FUNCTION set_buildium_property_id();
