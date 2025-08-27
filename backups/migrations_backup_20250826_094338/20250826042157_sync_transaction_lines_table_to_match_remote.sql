-- Migration: Sync transaction_lines table to match remote database
-- Description: Rename fields, add missing fields, and remove extra fields to match remote schema
-- Author: Property Management System
-- Date: 2025-08-26

-- First, drop the extra columns that don't exist in remote
ALTER TABLE public.transaction_lines DROP COLUMN IF EXISTS reference_number;
ALTER TABLE public.transaction_lines DROP COLUMN IF EXISTS line_type;
ALTER TABLE public.transaction_lines DROP COLUMN IF EXISTS is_debit;
ALTER TABLE public.transaction_lines DROP COLUMN IF EXISTS is_credit;
ALTER TABLE public.transaction_lines DROP COLUMN IF EXISTS buildium_transaction_line_id;
ALTER TABLE public.transaction_lines DROP COLUMN IF EXISTS buildium_gl_account_id;
ALTER TABLE public.transaction_lines DROP COLUMN IF EXISTS buildium_created_at;
ALTER TABLE public.transaction_lines DROP COLUMN IF EXISTS buildium_updated_at;

-- Add missing columns that exist in remote
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_lines' AND column_name = 'buildium_journal_id') THEN
        ALTER TABLE public.transaction_lines ADD COLUMN buildium_journal_id INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_lines' AND column_name = 'account_entity_id') THEN
        ALTER TABLE public.transaction_lines ADD COLUMN account_entity_id INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_lines' AND column_name = 'account_entity_type') THEN
        ALTER TABLE public.transaction_lines ADD COLUMN account_entity_type CHARACTER VARYING NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_lines' AND column_name = 'buildium_unit_id') THEN
        ALTER TABLE public.transaction_lines ADD COLUMN buildium_unit_id INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_lines' AND column_name = 'date') THEN
        ALTER TABLE public.transaction_lines ADD COLUMN date DATE NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_lines' AND column_name = 'posting_type') THEN
        ALTER TABLE public.transaction_lines ADD COLUMN posting_type CHARACTER VARYING NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_lines' AND column_name = 'buildium_property_id') THEN
        ALTER TABLE public.transaction_lines ADD COLUMN buildium_property_id INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_lines' AND column_name = 'buildium_lease_id') THEN
        ALTER TABLE public.transaction_lines ADD COLUMN buildium_lease_id INTEGER;
    END IF;
END
$$;
