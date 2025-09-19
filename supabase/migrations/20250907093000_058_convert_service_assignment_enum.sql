-- Create new enum assignment_level and convert properties.service_assignment to it
-- Maps old values: 'Building' -> 'Property Level', 'Unit' -> 'Unit Level'

BEGIN;

-- 1) Create new enum type if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'assignment_level'
  ) THEN
    CREATE TYPE public.assignment_level AS ENUM ('Property Level','Unit Level');
    COMMENT ON TYPE public.assignment_level IS 'Assignment level labels for UI: Property Level, Unit Level.';
  END IF;
END $$;

-- 2) If properties.service_assignment already uses the new enum, skip conversion
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    JOIN pg_type t ON t.typname = c.udt_name
    WHERE c.table_schema = 'public'
      AND c.table_name = 'properties'
      AND c.column_name = 'service_assignment'
      AND t.typname = 'assignment_level'
  ) THEN
    -- Already converted; nothing to do
    RETURN;
  END IF;
END $$;

-- 3) Add temp column with new enum
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS service_assignment_new public.assignment_level NULL;

-- 4) Backfill temp column mapping from old enum if old column exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'service_assignment'
  ) THEN
    UPDATE public.properties p
    SET service_assignment_new = CASE
      WHEN p.service_assignment::text = 'Building' THEN 'Property Level'::public.assignment_level
      WHEN p.service_assignment::text = 'Unit' THEN 'Unit Level'::public.assignment_level
      ELSE NULL
    END;
  END IF;
END $$;

-- 5) Swap columns
ALTER TABLE public.properties DROP COLUMN IF EXISTS service_assignment;
ALTER TABLE public.properties RENAME COLUMN service_assignment_new TO service_assignment;

COMMENT ON COLUMN public.properties.service_assignment IS 'Scope at which services are assigned (Property Level or Unit Level).';

COMMIT;

