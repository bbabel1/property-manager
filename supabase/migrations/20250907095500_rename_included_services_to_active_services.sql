-- Rename properties.included_services -> properties.active_services
-- Idempotent: only renames if old column exists and new one does not

BEGIN;

DO $$ BEGIN
  -- If target already exists, skip
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'active_services'
  ) THEN
    RETURN;
  END IF;

  -- If old column exists, perform rename
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'included_services'
  ) THEN
    ALTER TABLE public.properties RENAME COLUMN included_services TO active_services;
  END IF;
END $$;

-- Update column comment if column present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'active_services'
  ) THEN
    COMMENT ON COLUMN public.properties.active_services IS 'List of active management services (enum array).';
  END IF;
END $$;

COMMIT;

