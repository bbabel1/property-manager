-- Migration: Make vendors.contact_id required (NOT NULL)

-- Ensure column exists (added in prior migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'contact_id'
  ) THEN
    RAISE EXCEPTION 'vendors.contact_id must exist before setting NOT NULL';
  END IF;
END $$;

-- Set NOT NULL (will fail if existing rows have nulls)
ALTER TABLE public.vendors
  ALTER COLUMN contact_id SET NOT NULL;

