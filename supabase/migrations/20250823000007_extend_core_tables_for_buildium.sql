-- Extend core tables for Buildium API compatibility
-- Migration: 20250823000003_extend_core_tables_for_buildium.sql
-- Description: Adds fields to properties, units, and owners tables to match Buildium API schema

-- Extend Properties table for Buildium compatibility
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type VARCHAR(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS square_footage INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bedrooms INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bathrooms DECIMAL(3,1);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS buildium_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS buildium_updated_at TIMESTAMP WITH TIME ZONE;

-- Add comments to document the new property fields
COMMENT ON COLUMN properties.property_type IS 'Buildium property type (e.g., SingleHomeUpToThreeHundredThousand, MultiFamilyTwoToFourUnits)';
COMMENT ON COLUMN properties.square_footage IS 'Total square footage of the property';
COMMENT ON COLUMN properties.bedrooms IS 'Number of bedrooms in the property';
COMMENT ON COLUMN properties.bathrooms IS 'Number of bathrooms in the property (can be decimal for half-baths)';
COMMENT ON COLUMN properties.is_active IS 'Whether the property is active in Buildium';
COMMENT ON COLUMN properties.buildium_created_at IS 'Timestamp when property was created in Buildium';
COMMENT ON COLUMN properties.buildium_updated_at IS 'Timestamp when property was last updated in Buildium';

-- Extend Units table for Buildium compatibility
ALTER TABLE units ADD COLUMN IF NOT EXISTS unit_type VARCHAR(50);
ALTER TABLE units ADD COLUMN IF NOT EXISTS square_footage INTEGER;
ALTER TABLE units ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE units ADD COLUMN IF NOT EXISTS buildium_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE units ADD COLUMN IF NOT EXISTS buildium_updated_at TIMESTAMP WITH TIME ZONE;

-- Add comments to document the new unit fields
COMMENT ON COLUMN units.unit_type IS 'Buildium unit type (e.g., Apartment, Condo, House, Studio)';
COMMENT ON COLUMN units.square_footage IS 'Square footage of the unit';
COMMENT ON COLUMN units.is_active IS 'Whether the unit is active in Buildium';
COMMENT ON COLUMN units.buildium_created_at IS 'Timestamp when unit was created in Buildium';
COMMENT ON COLUMN units.buildium_updated_at IS 'Timestamp when unit was last updated in Buildium';

-- Extend Owners table for Buildium compatibility
ALTER TABLE owners ADD COLUMN IF NOT EXISTS tax_id VARCHAR(255);
ALTER TABLE owners ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS buildium_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS buildium_updated_at TIMESTAMP WITH TIME ZONE;

-- Add comments to document the new owner fields
COMMENT ON COLUMN owners.tax_id IS 'Tax identification number for the owner';
COMMENT ON COLUMN owners.is_active IS 'Whether the owner is active in Buildium';
COMMENT ON COLUMN owners.buildium_created_at IS 'Timestamp when owner was created in Buildium';
COMMENT ON COLUMN owners.buildium_updated_at IS 'Timestamp when owner was last updated in Buildium';

-- Create indexes for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_buildium_updated ON properties(buildium_updated_at);

CREATE INDEX IF NOT EXISTS idx_units_active ON units(is_active);
CREATE INDEX IF NOT EXISTS idx_units_type ON units(unit_type);
CREATE INDEX IF NOT EXISTS idx_units_buildium_updated ON units(buildium_updated_at);

CREATE INDEX IF NOT EXISTS idx_owners_active ON owners(is_active);
CREATE INDEX IF NOT EXISTS idx_owners_tax_id ON owners(tax_id);
CREATE INDEX IF NOT EXISTS idx_owners_buildium_updated ON owners(buildium_updated_at);

-- Create function to map local property to Buildium format
CREATE OR REPLACE FUNCTION map_property_to_buildium(p_property_id UUID)
RETURNS JSONB AS $$
DECLARE
  property_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO property_record FROM properties WHERE id = p_property_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property with ID % not found', p_property_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'Name', property_record.name,
    'Address', jsonb_build_object(
      'AddressLine1', property_record.address_line1,
      'AddressLine2', COALESCE(property_record.address_line2, ''),
      'City', COALESCE(property_record.city, ''),
      'State', COALESCE(property_record.state, ''),
      'PostalCode', property_record.postal_code,
      'Country', COALESCE(property_record.country, 'United States')
    ),
    'PropertyType', COALESCE(property_record.property_type, 'MultiFamilyTwoToFourUnits'),
    'YearBuilt', property_record.year_built,
    'SquareFootage', property_record.square_footage,
    'Bedrooms', property_record.bedrooms,
    'Bathrooms', property_record.bathrooms,
    'Description', COALESCE(property_record.structure_description, ''),
    'IsActive', COALESCE(property_record.is_active, true)
  );
  
  RETURN buildium_data;
END;
$$ LANGUAGE plpgsql;

-- Create function to map local unit to Buildium format
CREATE OR REPLACE FUNCTION map_unit_to_buildium(p_unit_id UUID)
RETURNS JSONB AS $$
DECLARE
  unit_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO unit_record FROM units WHERE id = p_unit_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit with ID % not found', p_unit_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'PropertyId', unit_record.property_id,
    'UnitNumber', unit_record.unit_number,
    'UnitType', COALESCE(unit_record.unit_type, 'Apartment'),
    'Bedrooms', unit_record.unit_bedrooms,
    'Bathrooms', unit_record.unit_bathrooms,
    'SquareFootage', unit_record.square_footage,
    'MarketRent', unit_record.market_rent,
    'Description', COALESCE(unit_record.description, ''),
    'IsActive', COALESCE(unit_record.is_active, true)
  );
  
  RETURN buildium_data;
END;
$$ LANGUAGE plpgsql;

-- Create function to map local owner to Buildium format
CREATE OR REPLACE FUNCTION map_owner_to_buildium(p_owner_id UUID)
RETURNS JSONB AS $$
DECLARE
  owner_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO owner_record FROM owners WHERE id = p_owner_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owner with ID % not found', p_owner_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'FirstName', COALESCE(owner_record.first_name, ''),
    'LastName', COALESCE(owner_record.last_name, ''),
    'Email', COALESCE(owner_record.email, ''),
    'PhoneNumber', COALESCE(owner_record.phone_home, owner_record.phone_mobile, ''),
    'Address', jsonb_build_object(
      'AddressLine1', owner_record.address_line1,
      'AddressLine2', COALESCE(owner_record.address_line2, ''),
      'City', COALESCE(owner_record.city, ''),
      'State', COALESCE(owner_record.state, ''),
      'PostalCode', owner_record.postal_code,
      'Country', COALESCE(owner_record.country, 'United States')
    ),
    'TaxId', COALESCE(owner_record.tax_id, ''),
    'IsActive', COALESCE(owner_record.is_active, true)
  );
  
  RETURN buildium_data;
END;
$$ LANGUAGE plpgsql;

-- Add comments to the mapping functions
COMMENT ON FUNCTION map_property_to_buildium IS 'Maps a local property record to Buildium API format';
COMMENT ON FUNCTION map_unit_to_buildium IS 'Maps a local unit record to Buildium API format';
COMMENT ON FUNCTION map_owner_to_buildium IS 'Maps a local owner record to Buildium API format';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Extended properties table with Buildium-compatible fields:';
    RAISE NOTICE '- property_type, square_footage, bedrooms, bathrooms';
    RAISE NOTICE '- is_active, buildium_created_at, buildium_updated_at';
    RAISE NOTICE '';
    RAISE NOTICE 'Extended units table with Buildium-compatible fields:';
    RAISE NOTICE '- unit_type, square_footage, is_active';
    RAISE NOTICE '- buildium_created_at, buildium_updated_at';
    RAISE NOTICE '';
    RAISE NOTICE 'Extended owners table with Buildium-compatible fields:';
    RAISE NOTICE '- tax_id, is_active, buildium_created_at, buildium_updated_at';
    RAISE NOTICE '';
    RAISE NOTICE 'Created mapping functions for Buildium API integration:';
    RAISE NOTICE '- map_property_to_buildium';
    RAISE NOTICE '- map_unit_to_buildium';
    RAISE NOTICE '- map_owner_to_buildium';
    RAISE NOTICE '';
    RAISE NOTICE 'Added appropriate indexes for performance';
END $$;
