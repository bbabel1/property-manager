-- Migration: Create Vendors Table
-- Date: 2025-08-23
-- Description: Create vendors table for financial data management

-- Create Vendors table with proper Buildium structure
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_vendor_id INTEGER UNIQUE,
  name VARCHAR(255) NOT NULL,
  category_id INTEGER,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone_number VARCHAR(50),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  tax_id VARCHAR(255),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the vendors table
COMMENT ON TABLE vendors IS 'Vendors/suppliers for property management services and supplies';
COMMENT ON COLUMN vendors.buildium_vendor_id IS 'Buildium API vendor ID for synchronization';
COMMENT ON COLUMN vendors.name IS 'Vendor company or individual name';
COMMENT ON COLUMN vendors.category_id IS 'Buildium vendor category ID';
COMMENT ON COLUMN vendors.contact_name IS 'Primary contact person name';
COMMENT ON COLUMN vendors.tax_id IS 'Tax identification number';
COMMENT ON COLUMN vendors.is_active IS 'Whether the vendor is active';

-- Create indexes for vendors table
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category_id);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_buildium_id ON vendors(buildium_vendor_id);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON vendors FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON vendors FOR UPDATE USING (true);
