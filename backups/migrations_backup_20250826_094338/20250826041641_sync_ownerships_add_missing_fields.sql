-- Migration: Sync ownerships table to match remote database
-- Description: Add missing fields total_units and total_properties to ownerships table
-- Author: Property Management System
-- Date: 2025-08-26

-- Add missing columns that exist in remote
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ownerships' AND column_name = 'total_units') THEN
        ALTER TABLE public.ownerships ADD COLUMN total_units INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ownerships' AND column_name = 'total_properties') THEN
        ALTER TABLE public.ownerships ADD COLUMN total_properties INTEGER NOT NULL DEFAULT 0;
    END IF;
END
$$;
