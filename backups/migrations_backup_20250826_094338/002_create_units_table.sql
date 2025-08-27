-- Migration: Create Units table with enums and constraints
-- Description: Creates the Units table with bedroom and bathroom enums, and proper relationships to Properties
-- Author: Ora Property Management
-- Date: 2025-01-27

-- Create unit_bedrooms_enum type
CREATE TYPE unit_bedrooms_enum AS ENUM (
    'NotSet', 'Studio', 'OneBed', 'TwoBed', 'ThreeBed', 'FourBed', 
    'FiveBed', 'SixBed', 'SevenBed', 'EightBed', 'NineBedPlus'
);

-- Create unit_bathrooms_enum type
CREATE TYPE unit_bathrooms_enum AS ENUM (
    'NotSet', 'OneBath', 'OnePointFiveBath', 'TwoBath', 'TwoPointFiveBath', 
    'ThreeBath', 'ThreePointFiveBath', 'FourBath', 'FourPointFiveBath', 
    'FiveBath', 'FivePlusBath'
);

-- Create Units table
CREATE TABLE units (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Foreign key to Properties table
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Unit identification
    unit_number VARCHAR(30) NOT NULL,
    
    -- Unit details
    unit_size INTEGER,
    market_rent NUMERIC(12,2),
    
    -- Address information
    address_line1 VARCHAR(100) NOT NULL,
    address_line2 VARCHAR(100),
    address_line3 VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,
    country country_enum NOT NULL,
    
    -- Unit specifications
    unit_bedrooms unit_bedrooms_enum,
    unit_bathrooms unit_bathrooms_enum,
    
    -- Description
    description TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add comments to table and columns
COMMENT ON TABLE units IS 'Stores rental unit information belonging to properties';
COMMENT ON COLUMN units.id IS 'Unique identifier for the unit (UUID)';
COMMENT ON COLUMN units.property_id IS 'References the parent property (foreign key)';
COMMENT ON COLUMN units.unit_number IS 'Unit number - must be unique within the same property';
COMMENT ON COLUMN units.unit_size IS 'Size of the unit in square feet/meters';
COMMENT ON COLUMN units.market_rent IS 'Market rent for listing purposes';
COMMENT ON COLUMN units.address_line1 IS 'Address line 1 (street, PO Box, or company name)';
COMMENT ON COLUMN units.address_line2 IS 'Address line 2 (apartment, suite, unit, or building)';
COMMENT ON COLUMN units.address_line3 IS 'Address line 3';
COMMENT ON COLUMN units.city IS 'City, district, suburb, town, or village';
COMMENT ON COLUMN units.state IS 'State, county, province, or region';
COMMENT ON COLUMN units.postal_code IS 'ZIP or postal code';
COMMENT ON COLUMN units.country IS 'Country - must match predefined enum values';
COMMENT ON COLUMN units.unit_bedrooms IS 'Number of bedrooms in the unit';
COMMENT ON COLUMN units.unit_bathrooms IS 'Number of bathrooms in the unit';
COMMENT ON COLUMN units.description IS 'Description of the unit (max 65,535 characters)';
COMMENT ON COLUMN units.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN units.updated_at IS 'Timestamp when the record was last updated';

-- Create unique constraint for property_id + unit_number combination
CREATE UNIQUE INDEX idx_units_property_unit_number ON units(property_id, unit_number);

-- Create indexes for better performance
CREATE INDEX idx_units_property_id ON units(property_id);
CREATE INDEX idx_units_unit_number ON units(unit_number);
CREATE INDEX idx_units_city ON units(city);
CREATE INDEX idx_units_state ON units(state);
CREATE INDEX idx_units_postal_code ON units(postal_code);
CREATE INDEX idx_units_country ON units(country);
CREATE INDEX idx_units_bedrooms ON units(unit_bedrooms);
CREATE INDEX idx_units_bathrooms ON units(unit_bathrooms);
CREATE INDEX idx_units_market_rent ON units(market_rent);
CREATE INDEX idx_units_created_at ON units(created_at);
CREATE INDEX idx_units_updated_at ON units(updated_at);

-- Create a composite index for address searches
CREATE INDEX idx_units_address_search ON units(city, state, postal_code, country);

-- Create trigger to automatically update updated_at on row changes
CREATE TRIGGER update_units_updated_at 
    BEFORE UPDATE ON units 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy (allow all operations for now - customize based on your auth requirements)
CREATE POLICY "Allow all operations on units" ON units
    FOR ALL USING (true);

-- Add comments to enums
COMMENT ON TYPE unit_bedrooms_enum IS 'Enumeration of bedroom counts for rental units';
COMMENT ON TYPE unit_bathrooms_enum IS 'Enumeration of bathroom counts for rental units';
