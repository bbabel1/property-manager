-- Migration: Add statement_recipients to properties table
-- Purpose: Store email recipients for monthly statement delivery
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS statement_recipients JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN properties.statement_recipients IS 'Array of {email, name, role} objects for monthly statement email delivery. Example: [{"email":"owner@example.com","name":"John Doe","role":"owner"}]';