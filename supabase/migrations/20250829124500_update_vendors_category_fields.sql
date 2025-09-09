-- Migration: Rename vendors.category_id -> buildium_category_id and add vendor_category FK

-- 1) Rename column category_id to buildium_category_id (int stays int)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'category_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.vendors RENAME COLUMN category_id TO buildium_category_id';
  END IF;
END $$;

-- 2) Add vendor_category (uuid) referencing vendor_categories(id)
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS vendor_category uuid;

-- Add FK constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND constraint_name = 'vendors_vendor_category_fkey'
  ) THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT vendors_vendor_category_fkey FOREIGN KEY (vendor_category) REFERENCES public.vendor_categories(id);
  END IF;
END $$;

-- Index for faster lookups by category
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_category ON public.vendors(vendor_category);

COMMENT ON COLUMN public.vendors.buildium_category_id IS 'Buildium vendor category id (source of truth from Buildium)';
COMMENT ON COLUMN public.vendors.vendor_category IS 'Local FK to vendor_categories table (one-to-many)';

