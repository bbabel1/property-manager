-- Migration: Create Properties table with enums and constraints
-- Description: Creates the Properties table with country and rental_sub_type enums
-- Author: Ora Property Management
-- Date: 2025-08-12

-- Create country_enum type
CREATE TYPE country_enum AS ENUM (
    'Afghanistan', 'Akrotiri', 'Albania', 'Algeria', 'AmericanSamoa', 'Andorra', 'Angola', 'Anguilla', 'Antarctica', 'AntiguaandBarbuda',
    'Argentina', 'Armenia', 'Aruba', 'AshmoreandCartierIslands', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh',
    'Barbados', 'BassasdaIndia', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bermuda', 'Bhutan', 'Bolivia', 'BosniaandHerzegovina', 'Botswana',
    'BouvetIsland', 'Brazil', 'BritishIndianOceanTerritory', 'BritishVirginIslands', 'Brunei', 'Bulgaria', 'BurkinaFaso', 'Burma', 'Burundi',
    'Cambodia', 'Cameroon', 'Canada', 'CapeVerde', 'CaymanIslands', 'CentralAfricanRepublic', 'Chad', 'Chile', 'China', 'ChristmasIsland',
    'ClippertonIsland', 'CocosIslands', 'Colombia', 'Comoros', 'DemocraticRepublicOfTheCongo', 'RepublicOfTheCongo', 'CookIslands',
    'CoralSeaIslands', 'CostaRica', 'CotedIvoire', 'Croatia', 'Cuba', 'Cyprus', 'CzechRepublic', 'Denmark', 'Dhekelia', 'Djibouti', 'Dominica',
    'DominicanRepublic', 'Ecuador', 'Egypt', 'ElSalvador', 'EquatorialGuinea', 'Eritrea', 'Estonia', 'Ethiopia', 'EuropaIsland',
    'FalklandIslands', 'FaroeIslands', 'Fiji', 'Finland', 'France', 'FrenchGuiana', 'FrenchPolynesia', 'FrenchSouthernandAntarcticLands',
    'Gabon', 'Gambia', 'GazaStrip', 'Georgia', 'Germany', 'Ghana', 'Gibraltar', 'GloriosoIslands', 'Greece', 'Greenland', 'Grenada', 'Guadeloupe',
    'Guam', 'Guatemala', 'Guernsey', 'Guinea', 'GuineaBissau', 'Guyana', 'Haiti', 'HeardIslandandMcDonaldIslands', 'VaticanCity', 'Honduras',
    'HongKong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'IsleofMan', 'Israel', 'Italy', 'Jamaica', 'JanMayen',
    'Japan', 'Jersey', 'Jordan', 'JuandeNovaIsland', 'Kazakhstan', 'Kenya', 'Kiribati', 'NorthKorea', 'SouthKorea', 'Kuwait', 'Kyrgyzstan',
    'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macau', 'Macedonia', 'Madagascar',
    'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'MarshallIslands', 'Martinique', 'Mauritania', 'Mauritius', 'Mayotte', 'Mexico',
    'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montserrat', 'Morocco', 'Mozambique', 'Namibia', 'Nauru', 'NavassaIsland', 'Nepal',
    'Netherlands', 'NetherlandsAntilles', 'NewCaledonia', 'NewZealand', 'Nicaragua', 'Niger', 'Nigeria', 'Niue', 'NorfolkIsland',
    'NorthernMarianaIslands', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Panama', 'PapuaNewGuinea', 'ParacelIslands', 'Paraguay', 'Peru',
    'Philippines', 'PitcairnIslands', 'Poland', 'Portugal', 'PuertoRico', 'Qatar', 'Reunion', 'Romania', 'Russia', 'Rwanda', 'SaintHelena',
    'SaintKittsandNevis', 'SaintLucia', 'SaintPierreandMiquelon', 'SaintVincentandtheGrenadines', 'Samoa', 'SanMarino', 'SaoTomeandPrincipe',
    'SaudiArabia', 'Senegal', 'SerbiaandMontenegro', 'Seychelles', 'SierraLeone', 'Singapore', 'Slovakia', 'Slovenia', 'SolomonIslands',
    'Somalia', 'SouthAfrica', 'SouthGeorgiaandtheSouthSandwichIslands', 'Spain', 'SpratlyIslands', 'SriLanka', 'Sudan', 'Suriname',
    'Svalbard', 'Swaziland', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'TimorLeste', 'Togo', 'Tokelau',
    'Tonga', 'TrinidadandTobago', 'TromelinIsland', 'Tunisia', 'Turkey', 'Turkmenistan'
);

-- Create rental_sub_type_enum type
CREATE TYPE rental_sub_type_enum AS ENUM (
    'CondoTownhome', 'MultiFamily', 'SingleFamily', 'Industrial', 'Office', 'Retail', 'ShoppingCenter', 'Storage', 'ParkingSpace'
);

-- Create Properties table
CREATE TABLE properties (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic property information
    name VARCHAR(127) NOT NULL CHECK (name != ''),
    structure_description TEXT,
    
    -- Address information
    address_line1 VARCHAR(100) NOT NULL CHECK (address_line1 != ''),
    address_line2 VARCHAR(100),
    address_line3 VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL CHECK (postal_code != ''),
    country country_enum NOT NULL,
    
    -- Integration and business fields
    buildium_property_id INTEGER,
    rental_sub_type rental_sub_type_enum NOT NULL,
    rental_owner_ids INTEGER[],
    operating_bank_account_id INTEGER NOT NULL,
    reserve NUMERIC(12,2) CHECK (reserve >= 0),
    year_built INTEGER CHECK (year_built >= 1000 AND year_built <= EXTRACT(YEAR FROM CURRENT_DATE)),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add comments to table and columns
COMMENT ON TABLE properties IS 'Stores rental property information including address, type, and business details';
COMMENT ON COLUMN properties.id IS 'Unique identifier for the property (UUID)';
COMMENT ON COLUMN properties.name IS 'Rental property name - non-empty string';
COMMENT ON COLUMN properties.structure_description IS 'Description of the rental property building';
COMMENT ON COLUMN properties.address_line1 IS 'Address line 1 (street, PO Box, or company name)';
COMMENT ON COLUMN properties.address_line2 IS 'Address line 2 (apartment, suite, unit, or building)';
COMMENT ON COLUMN properties.address_line3 IS 'Address line 3';
COMMENT ON COLUMN properties.city IS 'City, district, suburb, town, or village';
COMMENT ON COLUMN properties.state IS 'State, county, province, or region';
COMMENT ON COLUMN properties.postal_code IS 'ZIP or postal code';
COMMENT ON COLUMN properties.country IS 'Country - must match predefined enum values';
COMMENT ON COLUMN properties.buildium_property_id IS 'Stores the Buildium property record ID for integration purposes';
COMMENT ON COLUMN properties.rental_sub_type IS 'Subtype of the rental property';
COMMENT ON COLUMN properties.rental_owner_ids IS 'List of owner IDs from Buildium who are associated with this property';
COMMENT ON COLUMN properties.operating_bank_account_id IS 'The primary bank account that a rental property uses for its income and expenses';
COMMENT ON COLUMN properties.reserve IS 'A property reserve is cash kept on hand for unexpected expenses. This is available cash that is not disbursed in an owner draw';
COMMENT ON COLUMN properties.year_built IS 'The year the rental property was built (must be between 1000 and the current year)';
COMMENT ON COLUMN properties.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN properties.updated_at IS 'Timestamp when the record was last updated';

-- Create indexes for better performance
CREATE INDEX idx_properties_name ON properties(name);
CREATE INDEX idx_properties_country ON properties(country);
CREATE INDEX idx_properties_rental_sub_type ON properties(rental_sub_type);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_state ON properties(state);
CREATE INDEX idx_properties_postal_code ON properties(postal_code);
CREATE INDEX idx_properties_buildium_property_id ON properties(buildium_property_id);
CREATE INDEX idx_properties_operating_bank_account_id ON properties(operating_bank_account_id);
CREATE INDEX idx_properties_created_at ON properties(created_at);
CREATE INDEX idx_properties_updated_at ON properties(updated_at);

-- Create a composite index for address searches
CREATE INDEX idx_properties_address_search ON properties(city, state, postal_code, country);

-- Create a GIN index for the array column
CREATE INDEX idx_properties_rental_owner_ids ON properties USING GIN(rental_owner_ids);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row changes
CREATE TRIGGER update_properties_updated_at 
    BEFORE UPDATE ON properties 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy (allow all operations for now - customize based on your auth requirements)
CREATE POLICY "Allow all operations on properties" ON properties
    FOR ALL USING (true);

-- Add comments to enums
COMMENT ON TYPE country_enum IS 'Enumeration of all supported countries for property addresses';
COMMENT ON TYPE rental_sub_type_enum IS 'Enumeration of rental property subtypes';
