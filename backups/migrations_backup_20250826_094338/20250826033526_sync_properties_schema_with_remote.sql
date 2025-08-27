-- Migration: Sync local properties schema with remote database
-- Remote has 27 fields, local has 17 fields
-- Need to add: structure_description, rental_owner_ids, reserve, rental_sub_type, primary_owner, status, deposit_trust_account_id, total_units, buildium_created_at, buildium_updated_at, rental_type
-- Need to remove: square_footage (if it exists and not in remote)

-- Remove field that exists in local but not in remote
ALTER TABLE public.properties DROP COLUMN IF EXISTS square_footage;

-- Add missing fields that exist in remote but not in local
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS structure_description text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS rental_owner_ids text[];
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS reserve numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS rental_sub_type text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS primary_owner uuid;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS deposit_trust_account_id bigint;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS total_units integer;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS buildium_created_at timestamptz;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS buildium_updated_at timestamptz;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS rental_type text;
