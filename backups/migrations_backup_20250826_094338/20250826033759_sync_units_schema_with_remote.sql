-- Migration: Sync local units schema with remote database
-- Remote has 36 fields, local has 9 fields
-- Need to add 27 missing fields to match remote schema

-- Add missing fields from remote units table
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS unit_size integer;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS address_line1 text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS address_line2 text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS address_line3 text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS unit_bedrooms text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS unit_bathrooms text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS last_inspection_date date;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS next_inspection_date date;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS service_start date;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS service_end date;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS service_plan text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS fee_type text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS fee_percent numeric;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS management_fee numeric;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS fee_frequency text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS active_services text[];
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS fee_notes text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS buildium_property_id bigint;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS unit_type text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS buildium_created_at timestamptz;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS buildium_updated_at timestamptz;
