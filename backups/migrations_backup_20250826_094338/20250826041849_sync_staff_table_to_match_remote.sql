-- Migration: Sync staff table to match remote database
-- Description: Remove extra fields and add missing buildium_user_id field to match remote schema
-- Author: Property Management System
-- Date: 2025-08-26

-- First, drop the extra columns that don't exist in remote
ALTER TABLE public.staff DROP COLUMN IF EXISTS "firstName";
ALTER TABLE public.staff DROP COLUMN IF EXISTS "lastName";
ALTER TABLE public.staff DROP COLUMN IF EXISTS "email";
ALTER TABLE public.staff DROP COLUMN IF EXISTS "phone";

-- Add missing column that exists in remote
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'buildium_user_id') THEN
        ALTER TABLE public.staff ADD COLUMN buildium_user_id INTEGER;
    END IF;
END
$$;
