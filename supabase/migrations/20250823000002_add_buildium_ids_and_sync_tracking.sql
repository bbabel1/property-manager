-- Add missing Buildium ID fields and sync status tracking
-- Migration: 20250823000002_add_buildium_ids_and_sync_tracking.sql
-- Description: Adds Buildium ID fields to core entities and creates sync status tracking

-- Add Buildium IDs to core entities that don't have them
ALTER TABLE units ADD COLUMN IF NOT EXISTS buildium_unit_id INTEGER;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS buildium_owner_id INTEGER;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS buildium_lease_id INTEGER;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS buildium_bank_id INTEGER;

-- Add comments to document the new fields
COMMENT ON COLUMN units.buildium_unit_id IS 'Buildium API unit ID for synchronization';
COMMENT ON COLUMN owners.buildium_owner_id IS 'Buildium API owner ID for synchronization';
COMMENT ON COLUMN "Lease".buildium_lease_id IS 'Buildium API lease ID for synchronization';
COMMENT ON COLUMN bank_accounts.buildium_bank_id IS 'Buildium API bank account ID for synchronization';

-- Create indexes for better performance when querying by Buildium IDs
CREATE INDEX IF NOT EXISTS idx_units_buildium_id ON units(buildium_unit_id);
CREATE INDEX IF NOT EXISTS idx_owners_buildium_id ON owners(buildium_owner_id);
CREATE INDEX IF NOT EXISTS idx_lease_buildium_id ON "Lease"(buildium_lease_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_buildium_id ON bank_accounts(buildium_bank_id);

-- Create Buildium sync status tracking table
CREATE TABLE IF NOT EXISTS buildium_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL, -- 'property', 'unit', 'owner', 'lease', 'bank_account'
  entity_id UUID NOT NULL,
  buildium_id INTEGER,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'synced', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the sync status table
COMMENT ON TABLE buildium_sync_status IS 'Tracks synchronization status between local entities and Buildium API';
COMMENT ON COLUMN buildium_sync_status.entity_type IS 'Type of entity being synced (property, unit, owner, lease, bank_account)';
COMMENT ON COLUMN buildium_sync_status.entity_id IS 'Local entity UUID';
COMMENT ON COLUMN buildium_sync_status.buildium_id IS 'Buildium API entity ID';
COMMENT ON COLUMN buildium_sync_status.sync_status IS 'Current sync status: pending, synced, or failed';

-- Create indexes for sync status table
CREATE INDEX IF NOT EXISTS idx_buildium_sync_entity ON buildium_sync_status(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_buildium_sync_status ON buildium_sync_status(sync_status);
CREATE INDEX IF NOT EXISTS idx_buildium_sync_buildium_id ON buildium_sync_status(buildium_id);
CREATE INDEX IF NOT EXISTS idx_buildium_sync_last_synced ON buildium_sync_status(last_synced_at);

-- Enable RLS on sync status table
ALTER TABLE buildium_sync_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for sync status table
CREATE POLICY "Enable read access for all users" ON buildium_sync_status FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON buildium_sync_status FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON buildium_sync_status FOR UPDATE USING (true);

-- Create function to update sync status
CREATE OR REPLACE FUNCTION update_buildium_sync_status(
  p_entity_type VARCHAR(50),
  p_entity_id UUID,
  p_buildium_id INTEGER,
  p_status VARCHAR(20),
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO buildium_sync_status (
    entity_type, entity_id, buildium_id, sync_status, error_message, last_synced_at, updated_at
  ) VALUES (
    p_entity_type, p_entity_id, p_buildium_id, p_status, p_error_message, 
    CASE WHEN p_status = 'synced' THEN now() ELSE NULL END, now()
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    buildium_id = EXCLUDED.buildium_id,
    sync_status = EXCLUDED.sync_status,
    error_message = EXCLUDED.error_message,
    last_synced_at = EXCLUDED.last_synced_at,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION update_buildium_sync_status IS 'Updates the sync status for a given entity with Buildium API';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Added Buildium ID fields to core entities:';
    RAISE NOTICE '- units.buildium_unit_id';
    RAISE NOTICE '- owners.buildium_owner_id';
    RAISE NOTICE '- Lease.buildium_lease_id';
    RAISE NOTICE '- bank_accounts.buildium_bank_id';
    RAISE NOTICE '';
    RAISE NOTICE 'Created buildium_sync_status table for tracking synchronization';
    RAISE NOTICE 'Created update_buildium_sync_status function for status management';
    RAISE NOTICE 'Added appropriate indexes and RLS policies';
END $$;
