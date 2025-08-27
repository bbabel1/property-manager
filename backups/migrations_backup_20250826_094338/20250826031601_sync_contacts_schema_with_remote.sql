-- Migration: Sync local contacts schema with remote database
-- Description: Remove tax fields and add display_name to match remote schema
-- Author: Property Management System
-- Date: 2025-08-26

-- Remove tax-related fields that don't exist in remote database
ALTER TABLE public.contacts DROP COLUMN IF EXISTS tax_payer_id;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS tax_payer_type;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS tax_payer_name;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS tax_address_line_1;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS tax_address_line_2;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS tax_address_line_3;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS tax_city;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS tax_state;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS tax_postal_code;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS tax_country;

-- Add display_name field that exists in remote database
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create a function to generate display names
CREATE OR REPLACE FUNCTION public.generate_display_name(
  p_first_name TEXT,
  p_last_name TEXT,
  p_company_name TEXT,
  p_is_company BOOLEAN
) RETURNS TEXT AS $$
BEGIN
  IF p_is_company AND p_company_name IS NOT NULL AND trim(p_company_name) != '' THEN
    RETURN trim(p_company_name);
  ELSIF p_first_name IS NOT NULL OR p_last_name IS NOT NULL THEN
    RETURN trim(concat(coalesce(p_first_name, ''), ' ', coalesce(p_last_name, '')));
  ELSE
    RETURN 'Unnamed Contact';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update existing records to populate display_name
UPDATE public.contacts 
SET display_name = public.generate_display_name(first_name, last_name, company_name, is_company)
WHERE display_name IS NULL;

-- Create trigger to automatically update display_name on changes
CREATE OR REPLACE FUNCTION public.update_contact_display_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.display_name := public.generate_display_name(
    NEW.first_name, 
    NEW.last_name, 
    NEW.company_name, 
    NEW.is_company
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_update_contact_display_name ON public.contacts;

-- Create trigger for insert and update
CREATE TRIGGER trg_update_contact_display_name
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contact_display_name();

-- Add comment to document the schema sync
COMMENT ON TABLE public.contacts IS 'Contacts table synced with remote database schema - 28 fields total';
