-- Migration: Create lease table in local database to match remote
-- Remote has a 'lease' table (singular) with 3 fields: id, rent_amount, security_deposit
-- Local database doesn't have a lease table at all

-- Create lease table to match remote structure
CREATE TABLE IF NOT EXISTS public.lease (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_amount numeric,
  security_deposit numeric
);

-- Add standard timestamps and indexes if needed
-- Note: keeping minimal to match remote exactly for now
