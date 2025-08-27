-- Migration: Create Bank Accounts table with enums and constraints
-- Description: Creates the bank_accounts table with bank account types and check layout types
-- Author: Ora Property Management
-- Date: 2025-01-27

-- Create bank_account_type_enum
CREATE TYPE bank_account_type_enum AS ENUM ('Checking', 'Savings');

-- Create check_layout_type_enum
CREATE TYPE check_layout_type_enum AS ENUM (
    'Voucher1StubBottomMemo1Signature',
    'Voucher2StubBottomMemo1Signature',
    'Voucher2StubBottomMemo2Signatures',
    'Voucher2StubTopMemo',
    'Voucher2StubsPrePrintedLayout'
);

-- Create bank_accounts table
CREATE TABLE bank_accounts (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Integration
    buildium_bank_id INTEGER,
    
    -- Basic information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    bank_account_type bank_account_type_enum NOT NULL,
    country country_enum NOT NULL,
    
    -- Account details
    account_number VARCHAR(255),
    routing_number VARCHAR(255),
    
    -- Check printing settings
    enable_remote_check_printing BOOLEAN DEFAULT false,
    enable_local_check_printing BOOLEAN DEFAULT false,
    check_layout_type check_layout_type_enum,
    signature_heading VARCHAR(255),
    
    -- Bank information
    fractional_number VARCHAR(255),
    bank_information_line1 VARCHAR(255),
    bank_information_line2 VARCHAR(255),
    bank_information_line3 VARCHAR(255),
    bank_information_line4 VARCHAR(255),
    bank_information_line5 VARCHAR(255),
    
    -- Company information
    company_information_line1 VARCHAR(255),
    company_information_line2 VARCHAR(255),
    company_information_line3 VARCHAR(255),
    company_information_line4 VARCHAR(255),
    company_information_line5 VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add comments to table and columns
COMMENT ON TABLE bank_accounts IS 'Stores bank account information for properties';
COMMENT ON COLUMN bank_accounts.id IS 'Unique identifier for the bank account (UUID)';
COMMENT ON COLUMN bank_accounts.buildium_bank_id IS 'Record ID from Buildium for future integrations';
COMMENT ON COLUMN bank_accounts.name IS 'Bank account name (required)';
COMMENT ON COLUMN bank_accounts.description IS 'Bank account description';
COMMENT ON COLUMN bank_accounts.bank_account_type IS 'Type of bank account (Checking or Savings)';
COMMENT ON COLUMN bank_accounts.country IS 'Country where the bank account is located (uses existing Country enum)';
COMMENT ON COLUMN bank_accounts.account_number IS 'Bank account number';
COMMENT ON COLUMN bank_accounts.routing_number IS 'Bank routing number';
COMMENT ON COLUMN bank_accounts.enable_remote_check_printing IS 'Whether remote check printing is enabled';
COMMENT ON COLUMN bank_accounts.enable_local_check_printing IS 'Whether local check printing is enabled';
COMMENT ON COLUMN bank_accounts.check_layout_type IS 'Check layout type for printing';
COMMENT ON COLUMN bank_accounts.signature_heading IS 'Signature heading text for checks';
COMMENT ON COLUMN bank_accounts.fractional_number IS 'Fractional form of routing number';
COMMENT ON COLUMN bank_accounts.bank_information_line1 IS 'Bank information line 1';
COMMENT ON COLUMN bank_accounts.bank_information_line2 IS 'Bank information line 2';
COMMENT ON COLUMN bank_accounts.bank_information_line3 IS 'Bank information line 3';
COMMENT ON COLUMN bank_accounts.bank_information_line4 IS 'Bank information line 4';
COMMENT ON COLUMN bank_accounts.bank_information_line5 IS 'Bank information line 5';
COMMENT ON COLUMN bank_accounts.company_information_line1 IS 'Company information line 1';
COMMENT ON COLUMN bank_accounts.company_information_line2 IS 'Company information line 2';
COMMENT ON COLUMN bank_accounts.company_information_line3 IS 'Company information line 3';
COMMENT ON COLUMN bank_accounts.company_information_line4 IS 'Company information line 4';
COMMENT ON COLUMN bank_accounts.company_information_line5 IS 'Company information line 5';
COMMENT ON COLUMN bank_accounts.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN bank_accounts.updated_at IS 'Timestamp when the record was last updated';

-- Create indexes for better performance
CREATE INDEX idx_bank_accounts_name ON bank_accounts(name);
CREATE INDEX idx_bank_accounts_buildium_bank_id ON bank_accounts(buildium_bank_id);
CREATE INDEX idx_bank_accounts_bank_account_type ON bank_accounts(bank_account_type);
CREATE INDEX idx_bank_accounts_country ON bank_accounts(country);
CREATE INDEX idx_bank_accounts_account_number ON bank_accounts(account_number);
CREATE INDEX idx_bank_accounts_routing_number ON bank_accounts(routing_number);
CREATE INDEX idx_bank_accounts_created_at ON bank_accounts(created_at);
CREATE INDEX idx_bank_accounts_updated_at ON bank_accounts(updated_at);

-- Create composite indexes for common queries
CREATE INDEX idx_bank_accounts_type_country ON bank_accounts(bank_account_type, country);

-- Create trigger to automatically update updated_at on row changes
CREATE TRIGGER update_bank_accounts_updated_at 
    BEFORE UPDATE ON bank_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy (allow all operations for now - customize based on your auth requirements)
CREATE POLICY "Allow all operations on bank_accounts" ON bank_accounts
    FOR ALL USING (true);

-- Add comments to enums
COMMENT ON TYPE bank_account_type_enum IS 'Enumeration of bank account types (Checking or Savings)';
COMMENT ON TYPE check_layout_type_enum IS 'Enumeration of check layout types for printing';

-- Update properties table to add foreign key constraint
-- First, drop the existing operating_bank_account_id column if it exists
ALTER TABLE properties DROP COLUMN IF EXISTS operating_bank_account_id;

-- Add the operating_bank_account_id column with proper foreign key constraint
ALTER TABLE properties ADD COLUMN operating_bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- Add comment for the foreign key column
COMMENT ON COLUMN properties.operating_bank_account_id IS 'The primary bank account that a rental property uses for its income and expenses';

-- Create index for the foreign key
CREATE INDEX idx_properties_operating_bank_account_id ON properties(operating_bank_account_id);
