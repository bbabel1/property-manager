-- Migration: Make buildium_lease_id unique in Lease table
ALTER TABLE "Lease"
ADD CONSTRAINT buildium_lease_id_unique UNIQUE ("buildium_lease_id");
