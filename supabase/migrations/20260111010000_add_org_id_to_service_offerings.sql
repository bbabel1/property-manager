-- Add org_id to service_offerings table for org-level isolation
-- This migration:
-- 1. Adds org_id column (nullable initially)
-- 2. Copies existing service offerings to all existing organizations
-- 3. Makes org_id NOT NULL
-- 4. Updates RLS policy to use is_org_member instead of (true)
-- 5. Adds index on org_id

BEGIN;

-- 1. Add org_id column (nullable initially for backfill)
ALTER TABLE public.service_offerings
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- 2. Copy existing service offerings to all existing organizations
-- This ensures each org has its own copy of the catalog
DO $$
DECLARE
  org_rec RECORD;
  offering_rec RECORD;
BEGIN
  -- For each organization
  FOR org_rec IN SELECT id FROM public.organizations
  LOOP
    -- For each existing service offering
    FOR offering_rec IN SELECT * FROM public.service_offerings WHERE org_id IS NULL
    LOOP
      -- Insert a copy of the offering for this org
      -- Note: code, applies_to, bill_on, billing_basis, default_rent_basis were removed in later migrations
      INSERT INTO public.service_offerings (
        name, category, description, default_rate, default_freq,
        markup_pct, markup_pct_cap, hourly_rate, hourly_min_hours,
        fee_type, is_active, org_id, created_at, updated_at
      ) VALUES (
        offering_rec.name, offering_rec.category, offering_rec.description,
        offering_rec.default_rate, offering_rec.default_freq,
        offering_rec.markup_pct, offering_rec.markup_pct_cap,
        offering_rec.hourly_rate, offering_rec.hourly_min_hours,
        offering_rec.fee_type, offering_rec.is_active, org_rec.id,
        offering_rec.created_at, offering_rec.updated_at
      );
    END LOOP;
  END LOOP;
  
  -- Delete the original null org_id records (they've been copied to all orgs)
  DELETE FROM public.service_offerings WHERE org_id IS NULL;
END $$;

-- 3. Make org_id NOT NULL now that all records have been backfilled
ALTER TABLE public.service_offerings
  ALTER COLUMN org_id SET NOT NULL;

-- 4. Add index on org_id for performance
CREATE INDEX IF NOT EXISTS idx_service_offerings_org_id 
  ON public.service_offerings(org_id);

-- 5. Update RLS policy to use is_org_member instead of (true)
DROP POLICY IF EXISTS service_offerings_read ON public.service_offerings;
CREATE POLICY service_offerings_read ON public.service_offerings
  FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

-- Also add write policies for org admins/managers
DROP POLICY IF EXISTS service_offerings_insert ON public.service_offerings;
CREATE POLICY service_offerings_insert ON public.service_offerings
  FOR INSERT
  WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS service_offerings_update ON public.service_offerings;
CREATE POLICY service_offerings_update ON public.service_offerings
  FOR UPDATE
  USING (public.is_org_admin_or_manager(auth.uid(), org_id))
  WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS service_offerings_delete ON public.service_offerings;
CREATE POLICY service_offerings_delete ON public.service_offerings
  FOR DELETE
  USING (public.is_org_admin_or_manager(auth.uid(), org_id));

COMMENT ON COLUMN public.service_offerings.org_id IS 'Organization that owns this service offering. Each org has its own catalog of offerings.';

COMMIT;

