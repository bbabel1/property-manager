-- Migration: Sync lease table to match remote database
-- Description: Add missing 19 fields to existing lease table to match remote exactly
-- Author: Property Management System
-- Date: 2025-08-26

-- First, change id column from UUID to BIGINT to match remote
ALTER TABLE public.lease ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.lease ALTER COLUMN id TYPE BIGINT USING (CASE WHEN id::text ~ '^[0-9]+$' THEN id::text::bigint ELSE 0 END);

-- Add missing fields (19 additional fields)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'propertyId') THEN
        ALTER TABLE public.lease ADD COLUMN "propertyId" UUID REFERENCES public.properties(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'lease_from_date') THEN
        ALTER TABLE public.lease ADD COLUMN lease_from_date TIMESTAMP WITHOUT TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'lease_to_date') THEN
        ALTER TABLE public.lease ADD COLUMN lease_to_date TIMESTAMP WITHOUT TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'status') THEN
        ALTER TABLE public.lease ADD COLUMN status CHARACTER VARYING;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'comment') THEN
        ALTER TABLE public.lease ADD COLUMN comment TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'createdAt') THEN
        ALTER TABLE public.lease ADD COLUMN "createdAt" TIMESTAMP WITHOUT TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'updatedAt') THEN
        ALTER TABLE public.lease ADD COLUMN "updatedAt" TIMESTAMP WITHOUT TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'unitId') THEN
        ALTER TABLE public.lease ADD COLUMN "unitId" UUID REFERENCES public.units(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'buildium_lease_id') THEN
        ALTER TABLE public.lease ADD COLUMN buildium_lease_id INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'unit_number') THEN
        ALTER TABLE public.lease ADD COLUMN unit_number CHARACTER VARYING;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'lease_type') THEN
        ALTER TABLE public.lease ADD COLUMN lease_type CHARACTER VARYING;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'term_type') THEN
        ALTER TABLE public.lease ADD COLUMN term_type CHARACTER VARYING;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'renewal_offer_status') THEN
        ALTER TABLE public.lease ADD COLUMN renewal_offer_status CHARACTER VARYING;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'is_eviction_pending') THEN
        ALTER TABLE public.lease ADD COLUMN is_eviction_pending BOOLEAN;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'current_number_of_occupants') THEN
        ALTER TABLE public.lease ADD COLUMN current_number_of_occupants INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'payment_due_day') THEN
        ALTER TABLE public.lease ADD COLUMN payment_due_day INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'automatically_move_out_tenants') THEN
        ALTER TABLE public.lease ADD COLUMN automatically_move_out_tenants BOOLEAN;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'buildium_created_at') THEN
        ALTER TABLE public.lease ADD COLUMN buildium_created_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'buildium_updated_at') THEN
        ALTER TABLE public.lease ADD COLUMN buildium_updated_at TIMESTAMP WITH TIME ZONE;
    END IF;
END
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_lease_property_id ON public.lease("propertyId");
CREATE INDEX IF NOT EXISTS idx_lease_unit_id ON public.lease("unitId");
CREATE INDEX IF NOT EXISTS idx_lease_buildium_id ON public.lease(buildium_lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_status ON public.lease(status);
CREATE INDEX IF NOT EXISTS idx_lease_dates ON public.lease(lease_from_date, lease_to_date);
