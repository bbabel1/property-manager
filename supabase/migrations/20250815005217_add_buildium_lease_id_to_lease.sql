-- Migration: Add buildium_lease_id to Lease table
ALTER TABLE "Lease"
ADD COLUMN IF NOT EXISTS "buildium_lease_id" INTEGER;
