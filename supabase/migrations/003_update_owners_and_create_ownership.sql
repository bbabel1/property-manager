-- Migration: Update Owners table and create Ownership join table
-- Description: Updates the Owner table to "owners" with comprehensive fields and creates Ownership join table for many-to-many relationships
-- Author: Ora Property Management
-- Date: 2025-01-27

-- Create tax_payer_type_enum
CREATE TYPE tax_payer_type_enum AS ENUM ('SSN', 'EIN');

-- Drop existing Owner table if it exists (will recreate as "owners")
DROP TABLE IF EXISTS "Owner" CASCADE;
DROP TABLE IF EXISTS property_owners CASCADE;

-- Create updated owners table
CREATE TABLE owners (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic owner information
    first_name VARCHAR(127),
    last_name VARCHAR(127),
    is_company BOOLEAN NOT NULL DEFAULT false,
    company_name VARCHAR(127),
    
    -- Dates
    date_of_birth DATE,
    management_agreement_start_date DATE,
    management_agreement_end_date DATE,
    
    -- Contact information
    email VARCHAR(255),
    alternate_email VARCHAR(255),
    phone_home VARCHAR(20),
    phone_work VARCHAR(20),
    phone_mobile VARCHAR(20),
    phone_fax VARCHAR(20),
    
    -- Address information
    address_line1 VARCHAR(100) NOT NULL,
    address_line2 VARCHAR(100),
    address_line3 VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,
    country country_enum NOT NULL,
    
    -- Additional information
    comment TEXT,
    
    -- Tax information
    tax_payer_id VARCHAR(255),
    tax_payer_type tax_payer_type_enum,
    tax_payer_name1 VARCHAR(40),
    tax_payer_name2 VARCHAR(40),
    tax_address_line1 VARCHAR(100),
    tax_address_line2 VARCHAR(100),
    tax_address_line3 VARCHAR(100),
    tax_city VARCHAR(100),
    tax_state VARCHAR(100),
    tax_postal_code VARCHAR(20),
    tax_country country_enum,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create ownership join table for many-to-many relationship
CREATE TABLE ownership (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Foreign keys
    owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Ownership details
    primary BOOLEAN DEFAULT false,
    ownership_percentage NUMERIC(5,2) CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
    disbursement_percentage NUMERIC(5,2) CHECK (disbursement_percentage >= 0 AND disbursement_percentage <= 100),
    owner_name VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add comments to owners table and columns
COMMENT ON TABLE owners IS 'Stores owner information for properties';
COMMENT ON COLUMN owners.id IS 'Unique identifier for the owner (UUID)';
COMMENT ON COLUMN owners.first_name IS 'First name of the owner (required if is_company = false)';
COMMENT ON COLUMN owners.last_name IS 'Last name of the owner (required if is_company = false)';
COMMENT ON COLUMN owners.is_company IS 'Indicates if owner is a company';
COMMENT ON COLUMN owners.company_name IS 'Company name (required if is_company = true)';
COMMENT ON COLUMN owners.date_of_birth IS 'Date of birth (YYYY-MM-DD format)';
COMMENT ON COLUMN owners.management_agreement_start_date IS 'Management agreement start date (YYYY-MM-DD format)';
COMMENT ON COLUMN owners.management_agreement_end_date IS 'Management agreement end date (YYYY-MM-DD format)';
COMMENT ON COLUMN owners.email IS 'Primary email address';
COMMENT ON COLUMN owners.alternate_email IS 'Alternate email address';
COMMENT ON COLUMN owners.phone_home IS 'Home phone number (10-20 characters)';
COMMENT ON COLUMN owners.phone_work IS 'Work phone number (10-20 characters)';
COMMENT ON COLUMN owners.phone_mobile IS 'Mobile phone number (10-20 characters)';
COMMENT ON COLUMN owners.phone_fax IS 'Fax number (10-20 characters)';
COMMENT ON COLUMN owners.address_line1 IS 'Street address (required)';
COMMENT ON COLUMN owners.address_line2 IS 'Optional address line';
COMMENT ON COLUMN owners.address_line3 IS 'Optional address line';
COMMENT ON COLUMN owners.city IS 'City';
COMMENT ON COLUMN owners.state IS 'State or province';
COMMENT ON COLUMN owners.postal_code IS 'ZIP or postal code (required)';
COMMENT ON COLUMN owners.country IS 'Country (uses existing Country enum)';
COMMENT ON COLUMN owners.comment IS 'Additional comments (max 65,535 characters)';
COMMENT ON COLUMN owners.tax_payer_id IS 'Tax payer ID (required if tax_payer_type is set)';
COMMENT ON COLUMN owners.tax_payer_type IS 'Tax payer type (SSN or EIN)';
COMMENT ON COLUMN owners.tax_payer_name1 IS 'Tax payer name 1';
COMMENT ON COLUMN owners.tax_payer_name2 IS 'Tax payer name 2';
COMMENT ON COLUMN owners.tax_address_line1 IS 'Tax address line 1';
COMMENT ON COLUMN owners.tax_address_line2 IS 'Optional tax address line';
COMMENT ON COLUMN owners.tax_address_line3 IS 'Optional tax address line';
COMMENT ON COLUMN owners.tax_city IS 'Tax address city';
COMMENT ON COLUMN owners.tax_state IS 'Tax address state';
COMMENT ON COLUMN owners.tax_postal_code IS 'Tax address postal code';
COMMENT ON COLUMN owners.tax_country IS 'Tax address country (uses existing Country enum)';
COMMENT ON COLUMN owners.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN owners.updated_at IS 'Timestamp when the record was last updated';

-- Add comments to ownership table and columns
COMMENT ON TABLE ownership IS 'Join table for many-to-many relationship between owners and properties';
COMMENT ON COLUMN ownership.id IS 'Unique identifier for the ownership record (UUID)';
COMMENT ON COLUMN ownership.owner_id IS 'References the owner (foreign key)';
COMMENT ON COLUMN ownership.property_id IS 'References the property (foreign key)';
COMMENT ON COLUMN ownership.primary IS 'Indicates if this is the primary owner';
COMMENT ON COLUMN ownership.ownership_percentage IS 'Percentage of ownership (0-100)';
COMMENT ON COLUMN ownership.disbursement_percentage IS 'Percentage of income distribution (0-100)';
COMMENT ON COLUMN ownership.owner_name IS 'Display name of the owner';
COMMENT ON COLUMN ownership.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN ownership.updated_at IS 'Timestamp when the record was last updated';

-- Create unique constraint to prevent duplicate owner-property combinations
CREATE UNIQUE INDEX idx_ownership_owner_property ON ownership(owner_id, property_id);

-- Create indexes for better performance
CREATE INDEX idx_owners_first_name ON owners(first_name);
CREATE INDEX idx_owners_last_name ON owners(last_name);
CREATE INDEX idx_owners_company_name ON owners(company_name);
CREATE INDEX idx_owners_email ON owners(email);
CREATE INDEX idx_owners_is_company ON owners(is_company);
CREATE INDEX idx_owners_city ON owners(city);
CREATE INDEX idx_owners_state ON owners(state);
CREATE INDEX idx_owners_postal_code ON owners(postal_code);
CREATE INDEX idx_owners_country ON owners(country);
CREATE INDEX idx_owners_created_at ON owners(created_at);
CREATE INDEX idx_owners_updated_at ON owners(updated_at);

-- Create indexes for ownership table
CREATE INDEX idx_ownership_owner_id ON ownership(owner_id);
CREATE INDEX idx_ownership_property_id ON ownership(property_id);
CREATE INDEX idx_ownership_primary ON ownership(primary);
CREATE INDEX idx_ownership_created_at ON ownership(created_at);
CREATE INDEX idx_ownership_updated_at ON ownership(updated_at);

-- Create composite indexes for common queries
CREATE INDEX idx_owners_name_search ON owners(first_name, last_name, company_name);
CREATE INDEX idx_owners_address_search ON owners(city, state, postal_code, country);

-- Create triggers to automatically update updated_at on row changes
CREATE TRIGGER update_owners_updated_at 
    BEFORE UPDATE ON owners 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ownership_updated_at 
    BEFORE UPDATE ON ownership 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE ownership ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (allow all operations for now - customize based on your auth requirements)
CREATE POLICY "Allow all operations on owners" ON owners
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on ownership" ON ownership
    FOR ALL USING (true);

-- Add comments to enums
COMMENT ON TYPE tax_payer_type_enum IS 'Enumeration of tax payer types (SSN or EIN)';

-- Add check constraints for data validation
ALTER TABLE owners ADD CONSTRAINT check_individual_owner_names 
    CHECK (
        (is_company = false AND (first_name IS NOT NULL OR last_name IS NOT NULL)) OR
        (is_company = true AND company_name IS NOT NULL)
    );

ALTER TABLE owners ADD CONSTRAINT check_tax_payer_info 
    CHECK (
        (tax_payer_id IS NULL AND tax_payer_type IS NULL) OR
        (tax_payer_id IS NOT NULL AND tax_payer_type IS NOT NULL)
    );

ALTER TABLE ownership ADD CONSTRAINT check_ownership_percentages 
    CHECK (
        (ownership_percentage IS NULL) OR
        (ownership_percentage >= 0 AND ownership_percentage <= 100)
    );

ALTER TABLE ownership ADD CONSTRAINT check_disbursement_percentages 
    CHECK (
        (disbursement_percentage IS NULL) OR
        (disbursement_percentage >= 0 AND disbursement_percentage <= 100)
    );
