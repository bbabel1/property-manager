-- Migration: Add primary_owner field to properties table with auto-population triggers
-- Description: Adds primary_owner field and triggers to auto-populate from ownership table
-- Author: Ora Property Management
-- Date: 2025-01-27

-- Add primary_owner field to properties table
ALTER TABLE properties ADD COLUMN primary_owner VARCHAR(255);

-- Add comment for the new field
COMMENT ON COLUMN properties.primary_owner IS 'Auto-populated from ownership record where is_primary = true; stores the owner name for quick reference';

-- Create index for the new field
CREATE INDEX idx_properties_primary_owner ON properties(primary_owner);

-- Create function to update primary_owner for a property
CREATE OR REPLACE FUNCTION update_property_primary_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the primary_owner field for the affected property
    UPDATE properties 
    SET primary_owner = (
        SELECT owner_name 
        FROM ownership 
        WHERE property_id = COALESCE(NEW.property_id, OLD.property_id) 
        AND is_primary = true 
        LIMIT 1
    )
    WHERE id = COALESCE(NEW.property_id, OLD.property_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create function to handle ownership record deletion
CREATE OR REPLACE FUNCTION handle_ownership_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- If the deleted record was primary, update the property's primary_owner
    IF OLD.is_primary = true THEN
        UPDATE properties 
        SET primary_owner = (
            SELECT owner_name 
            FROM ownership 
            WHERE property_id = OLD.property_id 
            AND is_primary = true 
            LIMIT 1
        )
        WHERE id = OLD.property_id;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update primary_owner when ownership records are inserted
CREATE TRIGGER update_primary_owner_on_insert
    AFTER INSERT ON ownership
    FOR EACH ROW
    WHEN (NEW.is_primary = true)
    EXECUTE FUNCTION update_property_primary_owner();

-- Create trigger to update primary_owner when ownership records are updated
CREATE TRIGGER update_primary_owner_on_update
    AFTER UPDATE ON ownership
    FOR EACH ROW
    WHEN (NEW.is_primary = true OR OLD.is_primary = true)
    EXECUTE FUNCTION update_property_primary_owner();

-- Create trigger to update primary_owner when ownership records are deleted
CREATE TRIGGER update_primary_owner_on_delete
    AFTER DELETE ON ownership
    FOR EACH ROW
    WHEN (OLD.is_primary = true)
    EXECUTE FUNCTION handle_ownership_deletion();

-- Initialize primary_owner field for existing properties
UPDATE properties 
SET primary_owner = (
    SELECT owner_name 
    FROM ownership 
    WHERE property_id = properties.id 
    AND is_primary = true 
    LIMIT 1
);
