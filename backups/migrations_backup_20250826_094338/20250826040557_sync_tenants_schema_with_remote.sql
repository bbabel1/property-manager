-- Migration: Sync tenants table to match remote database
-- Description: Remove 7 extra fields, add 7 missing fields, fix timestamps to match remote exactly
-- Author: Property Management System
-- Date: 2025-08-26

-- First, drop the extra columns that don't exist in remote
ALTER TABLE public.tenants DROP COLUMN IF EXISTS first_name;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS last_name;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS email;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS phone_number;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS move_in_date;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS move_out_date;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS lease_id;

-- Add missing columns that exist in remote
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'emergency_contact_name') THEN
        ALTER TABLE public.tenants ADD COLUMN emergency_contact_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'emergency_contact_relationship') THEN
        ALTER TABLE public.tenants ADD COLUMN emergency_contact_relationship TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'emergency_contact_phone') THEN
        ALTER TABLE public.tenants ADD COLUMN emergency_contact_phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'emergency_contact_email') THEN
        ALTER TABLE public.tenants ADD COLUMN emergency_contact_email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'sms_opt_in_status') THEN
        ALTER TABLE public.tenants ADD COLUMN sms_opt_in_status CHARACTER VARYING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'comment') THEN
        ALTER TABLE public.tenants ADD COLUMN comment TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'tax_id') THEN
        ALTER TABLE public.tenants ADD COLUMN tax_id TEXT;
    END IF;
END
$$;

-- Fix created_at and updated_at to be NOT NULL with defaults
ALTER TABLE public.tenants ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.tenants ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.tenants ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.tenants ALTER COLUMN updated_at SET DEFAULT NOW();

-- Add updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_contact_id ON public.tenants(contact_id);
CREATE INDEX IF NOT EXISTS idx_tenants_buildium_id ON public.tenants(buildium_tenant_id);
