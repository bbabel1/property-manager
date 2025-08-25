-- Add last_contacted field to owners table
-- Migration: 20250823000001_add_last_contacted_to_owners.sql
-- Description: Adds last_contacted timestamp field to track when owners were last contacted

-- Add last_contacted column to owners table
ALTER TABLE owners ADD COLUMN IF NOT EXISTS last_contacted TIMESTAMP WITH TIME ZONE;

-- Add comment to document the field
COMMENT ON COLUMN owners.last_contacted IS 'Timestamp of when this owner was last contacted';

-- Create index for better performance when querying by last_contacted
CREATE INDEX IF NOT EXISTS idx_owners_last_contacted ON owners(last_contacted);

-- Log the addition for audit purposes
DO $$
BEGIN
    RAISE NOTICE 'Added last_contacted field to owners table';
    RAISE NOTICE '- Field type: TIMESTAMP WITH TIME ZONE (nullable)';
    RAISE NOTICE '- Added index for performance';
    RAISE NOTICE '- Added documentation comment';
END $$;

