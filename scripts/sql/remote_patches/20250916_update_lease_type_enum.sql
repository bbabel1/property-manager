-- Convert lease.lease_type to enum and drop obsolete term_type
DO $$ BEGIN
  CREATE TYPE public.lease_type_enum AS ENUM ('Fixed','FixedWithRollover','AtWill');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure column exists before altering
ALTER TABLE public.lease
  ALTER COLUMN lease_type TYPE public.lease_type_enum USING (
    CASE
      WHEN lease_type IN ('Fixed','FixedWithRollover','AtWill') THEN lease_type::public.lease_type_enum
      WHEN lease_type IS NULL THEN 'Fixed'::public.lease_type_enum
      ELSE 'Fixed'::public.lease_type_enum
    END
  ),
  ALTER COLUMN lease_type SET DEFAULT 'Fixed'::public.lease_type_enum,
  ALTER COLUMN lease_type SET NOT NULL;

-- Drop old term_type column if present
ALTER TABLE public.lease DROP COLUMN IF EXISTS term_type;

