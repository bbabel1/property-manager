-- Data Integrity Validation Functions and Tables
-- This migration adds functions and tables needed for comprehensive data validation

-- Find duplicate units within same property
CREATE OR REPLACE FUNCTION find_duplicate_units()
RETURNS TABLE(property_id UUID, unit_number VARCHAR, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT u.property_id, u.unit_number, COUNT(*)::BIGINT
  FROM units u
  GROUP BY u.property_id, u.unit_number
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql;

-- Find duplicate Buildium IDs
CREATE OR REPLACE FUNCTION find_duplicate_buildium_ids(table_name TEXT, buildium_field TEXT)
RETURNS TABLE(buildium_id INTEGER, count BIGINT) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT %I::INTEGER, COUNT(*)::BIGINT
    FROM %I
    WHERE %I IS NOT NULL
    GROUP BY %I
    HAVING COUNT(*) > 1
  ', buildium_field, table_name, buildium_field, buildium_field);
END;
$$ LANGUAGE plpgsql;

-- Find duplicate ownerships
CREATE OR REPLACE FUNCTION find_duplicate_ownerships()
RETURNS TABLE(owner_id UUID, property_id UUID, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT o.owner_id, o.property_id, COUNT(*)::BIGINT
  FROM ownerships o
  GROUP BY o.owner_id, o.property_id
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql;

-- Sync Operations Table for Error Recovery
CREATE TABLE IF NOT EXISTS sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('CREATE', 'UPDATE', 'DELETE')),
  entity VARCHAR(20) NOT NULL CHECK (entity IN ('property', 'unit', 'lease', 'tenant', 'contact', 'owner')),
  buildium_id INTEGER NOT NULL,
  local_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ROLLED_BACK')),
  data JSONB NOT NULL,
  dependencies TEXT[],
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON sync_operations(status);
CREATE INDEX IF NOT EXISTS idx_sync_operations_entity_buildium_id ON sync_operations(entity, buildium_id);
CREATE INDEX IF NOT EXISTS idx_sync_operations_created_at ON sync_operations(created_at);

-- RLS policies for sync operations
ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync operations for their org" ON sync_operations
  FOR SELECT USING (true); -- Adjust based on your org_id pattern

CREATE POLICY "Service role can manage sync operations" ON sync_operations
  FOR ALL USING (auth.role() = 'service_role');

-- Add comments
COMMENT ON TABLE sync_operations IS 'Tracks sync operations for error recovery and monitoring';
COMMENT ON COLUMN sync_operations.type IS 'Type of operation: CREATE, UPDATE, DELETE';
COMMENT ON COLUMN sync_operations.entity IS 'Entity type being synced';
COMMENT ON COLUMN sync_operations.buildium_id IS 'Buildium ID for the entity';
COMMENT ON COLUMN sync_operations.local_id IS 'Local database ID after successful creation';
COMMENT ON COLUMN sync_operations.status IS 'Current status of the operation';
COMMENT ON COLUMN sync_operations.data IS 'Original Buildium data for the operation';
COMMENT ON COLUMN sync_operations.dependencies IS 'IDs of operations this depends on';
COMMENT ON COLUMN sync_operations.error IS 'Error message if operation failed';
COMMENT ON COLUMN sync_operations.attempts IS 'Number of retry attempts made';
