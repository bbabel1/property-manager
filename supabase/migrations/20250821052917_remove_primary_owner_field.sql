-- Remove redundant primary_owner field from properties table
-- Migration: 20250821052917_remove_primary_owner_field.sql

-- Remove the primary_owner field since ownership is now managed through ownerships table
ALTER TABLE properties DROP COLUMN IF EXISTS primary_owner;

-- Add a comment to document the change
COMMENT ON TABLE properties IS 'Properties table - primary owner now determined from ownerships table where primary = true';
