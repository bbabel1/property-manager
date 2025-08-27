-- Migration: Create Tenants Table
-- Date: 2025-08-21
-- Description: Create tenants table for property management

-- Create Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_tenant_id INTEGER UNIQUE,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone_number VARCHAR(50),
  date_of_birth DATE,
  move_in_date DATE,
  move_out_date DATE,
  lease_id BIGINT NOT NULL REFERENCES "Lease"("id") ON DELETE CASCADE,
  contact_id BIGINT REFERENCES contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments
COMMENT ON TABLE tenants IS 'Tenants associated with leases';
COMMENT ON COLUMN tenants.buildium_tenant_id IS 'Buildium API tenant ID for synchronization';
COMMENT ON COLUMN tenants.lease_id IS 'Reference to the lease this tenant is associated with';
COMMENT ON COLUMN tenants.contact_id IS 'Reference to the contact record for this tenant';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenants_buildium_id ON tenants(buildium_tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_lease_id ON tenants(lease_id);
CREATE INDEX IF NOT EXISTS idx_tenants_contact_id ON tenants(contact_id);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy
CREATE POLICY "Allow all operations on tenants" ON tenants FOR ALL USING (true);
